const EventEmitter = require('events').EventEmitter
const Rx = require('rx')
const fetch = require('node-fetch')
const log4js = require('log4js')
const logger = log4js.getLogger('skEmbed')
const util = require('./util')
const Request = require('./request')
const Response = require('./response')
const net = require('net')


class SiRuDevice extends EventEmitter {
  /**
   *
   * @param {string} room
   * @param {object} options
   */
  constructor(room, options) {
    super(options)

    const default_opt = {
      'ssgaddress': 'localhost',
      'extport': 15000,
      'dashboardport': 3000
    }

    this.room = room
    this.roomStatus = util.ROOMSTATUS.LEAVED
    this.options = Object.assign({}, default_opt, options)
    this.profile = {}
    this.topics = []
    this.status = util.STATUS.IDLE
    this.sendQueue = []
    this.callbacks = []

    this.observers = []

    this.pow = 0
    this._start();
  }

  _start() {
    this.pow++
    if(this.pow > 6) this.pow = 6

    const interval = Math.pow(2, this.pow) * 1000
    logger.debug(`_start: interval = ${interval}`)

    setTimeout( () => {
      this.startConnection()
        .then( () => this.setMesgHandler() )
        .then( () => this.emitConnect() )
        .then( () => this.getProfile() )
        .then( () => this.emitMeta() )
        .catch(err => logger.error(err))
    }, interval)
  }

  /**
   * establish TCP connection with ExtInterface of SSG
   */
  startConnection() {
    return new Promise((resolv, reject) => {
      switch(this.status) {
      case util.STATUS.IDLE:
      case util.STATUS.CONNECTING:
        this.status = util.STATUS.CONNECTING
        break
      case util.STATUS.RECONNECTING:
        break
      default:
        reject(`startConnection: unexpected status (${this.status})`)
        return
      }

      console.info(`connecting to SSG (status = ${this.status})`)
      this.client = new net.Socket()

      this.client.on('connect', () => {
        this.pow = 0
        switch(this.status) {
        case util.STATUS.CONNECTING:
          this.status = util.STATUS.CONNECTED
          break;
        case util.STATUS.RECONNECTING:
          this.status = util.STATUS.RECONNECTED
          break;
        default:
          reject(`onConnect: unexpected status (${this.status})`)
          return;
        }
        logger.info(`socket connected. status = ${this.status}`)
        resolv();
      })

      // when tcp connection has closed
      this.client.on('close', () => {
        logger.warn(`socket closed. start reconnecting`)
        if(this.status === util.STATUS.CONNECTING || this.status === util.STATUS.RECONNECTING ) {
          // this is initial connecting, keep status as CONNECTING
          reject(`onClose: status is ${this.status}`)
          this._start();
        } else if (this.status === util.STATUS.CONNECTED || util.STATUS.RECONNECTED) {
          // this is restarting of SSG or so, change status to RECONNECTING
          this.status = util.STATUS.RECONNECTING
          this._start()
        } else {
          logger.warn(`onClose: unexpected status (${this.status})`);
        }
      })

      this.client.on('error', (err) =>{
        if(this.status === util.STATUS.CONNECTING || this.status === util.STATUS.RECONNECTING) {
          reject(err)
        } else {
          logger.error(`error in socket. status is (${this.status}).`)
        }
      })

      this.client.connect(this.options.extport, this.options.ssgaddress)
    })
  }

  /**
   *
   */
  setMesgHandler() {
    // refresh existing observer
    this.observers.forEach( observer => {
      observer.dispose()
    })
    this.observers.length = 0

    // transform binary data to json object.
    // {handle_id, data}
    // this also filter out when it does not have data.topic nor data.payload
    const receiveObserver = Rx.Observable.fromEvent(this.client, 'data')
      .filter(buf => buf.length > 8) // validate buffer length
      .map(buf => {
        const handle_id = buf.slice(0, 8)
        const data_ = buf.slice(8).toString()

        let data

        try {
          data = JSON.parse(data_)
        } catch(err) {
          data = data_
        }
        return {handle_id, data}
      })
      .filter(obj => obj.data.topic && obj.data.payload)
    // this.observers.push(receiveObserver)

    // when receive data is for REST api
    const requestSubscriber = receiveObserver
      .filter( obj => obj.data.topic === this.profile.uuid )
      .subscribe( obj => {
        try {
          const payload = obj.data.payload
          const method  = payload.method.toLowerCase()
          const path    = payload.path
          let sent = false

          this.callbacks
            .filter(cb_obj => cb_obj.method === method )
            .forEach(cb_obj => {
              const params = util.check_path(cb_obj.path, path)

              if(!params) return

              const req = new Request(obj, this)
              const res = new Response(obj, this)

              req.params = params
              cb_obj.callback(req, res)
              sent = true
            })

          if(!sent) {
            const res = new Response(obj, this)
            res.setStatus(404).send("Not found")
          }
        } catch(err) {
          logger.warn(err)
        }
      })
    this.observers.push(requestSubscriber)

    // when receved data is for pub/sub message
    const messageSubscriber = receiveObserver
      .filter( obj => {
        return this.topics.filter(t => t === obj.data.topic).length === 1
      })
      .subscribe( obj => {
        const topic = obj.data.topic
        const payload = obj.data.payload

        this.emit('message', topic, payload)
      })
    this.observers.push(messageSubscriber)

    // send queue
    const sendQueueSubscriber = Rx.Observable.fromEvent(this, 'inject/sendqueue')
      .subscribe(obj => {
        const buf = Buffer.concat([obj.handle_id, new Buffer(obj.data)])
        this.sendQueue.push(buf)
      })
    this.observers.push(sendQueueSubscriber)

    const sendSubscriber = Rx.Observable.interval(util.QUEUE_SEND_INTERVAL)
      .subscribe( () => {
        if(this.client.bufferSize !== 0) return

        const buf = this.sendQueue.shift()
        if(buf) {
          this.client.write(buf)
        }
      })
    this.observers.push(sendSubscriber)
  }

  /**
   * emit `connect` message
   */
  emitConnect() {
    return new Promise((resolv, reject) => {
      switch(this.status) {
      case util.STATUS.CONNECTED:
        this.emit('connect')
        break
      case util.STATUS.RECONNECTED:
        this.emit('reconnect')
        break;
      default:
        reject(`emitConnect: unexpected status (${this.status})`)
        return;
      }

      resolv()
    })
  }

  /**
   *
   */
  getProfile() {
    return new Promise((resolv, reject) => {
      const url = util.PROFILE_URL(this.options.ssgaddress, this.options.dashboardport)
      logger.debug(`getProfile: ${url}`)

      const _fetch = () => {
        fetch(url).then(res => res.json())
          .then(json => {
            this.profile = json
            logger.info('getProfile: obtaining profile succeeded.')
            resolv()
          })
          .catch(err => {
            logger.warn(err)
            setTimeout(ev => {
              logger.warn('getProfile: cannot fetch. try re-fetching...')
              _fetch()
            }, 1000)
          })
      }
      _fetch()
    })
  }

  /**
   *
   */
  emitMeta() {
    return new Promise((resolv, reject) => {
      this.emit('meta', this.profile)
      resolv()
    })
  }

  /**
   *
   * @param {function} callback
   */
  get(path, callback) {
    this.callbacks.push({method: 'get', path, callback})
  }

  post(path, callback) {
    this.callbacks.push({method: 'post', path, callback})
  }

  put(path, callback) {
    this.callbacks.push({method: 'put', path, callback})
  }

  delete(path, callback) {
    this.callbacks.push({method: 'delete', path, callback})
  }

  /**
   *
   * @param {string} topic
   */
  subscribe(topic){
    this.topics.push(topic)
  }

  /**
   *
   * @param {string} topic
   */
  unsubscribe(topic) {
    this.topics = this.topics.filter(t => t !== topic)
  }


  /**
   *
   * @param {string} topic
   * @param {string|object} data
   */
  publish(topic, data){
    this.send(util.HANDLER.BROADCAST_ID, {topic, payload: data})
  }

  /**
   *
   * @param {string} uuid
   * @param {*} data
   */
  send(handle_id, data){
    let sData;

    if(typeof(data) === 'object') sData = JSON.stringify(data)
    else if(typeof(data) === 'string') sData = data
    else sData = data.toString()

    this.emit('inject/sendqueue', {handle_id, data: sData})
  }

  /**
   *
   * @param {string} data
   */
  sendCtrlData(data){
    this.send(util.HANDLER.CONTROL_ID, data)
  }
}

module.exports = SiRuDevice
