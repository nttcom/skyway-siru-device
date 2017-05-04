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
    this.options = Object.assign({}, default_opt, options)
    this.profile = {}
    this.topics = []
    this.status = util.STATUS.IDLE
    this.sendQueue = []
    this.callbacks = []

    this.startConnection()
      .then( () => this.setMesgHandler() )
      .then( () => this.emitConnect() )
      .then( () => this.getProfile() )
      .then( () => this.emitMeta() )
      .then( () => this.joinRoom() )
      .catch(err => logger.warn(err))
  }

  /**
   * establish TCP connection with ExtInterface of SSG
   */
  startConnection() {
    return new Promise((resolv, reject) => {
      this.status = util.STATUS.CONNECTING
      this.client = new net.Socket()

      this.client.on('connect', () => {
        this.status = util.STATUS.CONNECTED
        resolv();
      })

      this.client.on('error', (err) =>{
        if(this.status === util.STATUS.CONNECTING) reject(err)
        this.status = util.STATUS.IDLE
      })
      this.client.connect(this.options.extport, this.options.ssgaddress)
    })
  }

  /**
   *
   */
  setMesgHandler() {
    // receiving data handler
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

    const requestSuscriber = receiveObserver
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

    const messageSubscriber = receiveObserver
      .filter( obj => {
        return this.topics.filter(t => t === obj.data.topic).length === 1
      })
      .subscribe( obj => {
        const topic = obj.data.topic
        const payload = obj.data.payload

        this.emit('message', topic, payload)
      })

    // send queue
    const sendQueueSubscriber = Rx.Observable.fromEvent(this, 'inject/sendqueue')
      .subscribe(obj => {
        const buf = Buffer.concat([obj.handle_id, new Buffer(obj.data)])
        this.sendQueue.push(buf)
      })

    const sendSubscriber = Rx.Observable.interval(10)
      .subscribe( () => {
        if(this.client.bufferSize !== 0) return

        const buf = this.sendQueue.shift()
        if(buf) {
          this.client.write(buf)
        }
      })
  }

  /**
   * emit `connect` message
   */
  emitConnect() {
    return new Promise((resolv, reject) => {
      this.emit('connect')
      resolv()
    })
  }

  /**
   *
   */
  getProfile() {
    return new Promise((resolv, reject) => {
      const url = util.PROFILE_URL(this.options.ssgaddress, this.options.dashboardport)
      fetch(url).then(res => res.json())
        .then(json => {
          this.profile = json
          resolv()
        })
        .catch(err => reject(err))
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





  joinRoom() {
    return new Promise((resolve, reject) => {
      const mesg = `${util.JOIN_ROOM},${this.room}`
      this.sendCtrlData(mesg)

      resolve()
    })
  }

  leaveRoom() {
    return new Promise((resolve, reject) => {
      const mesg = `${util.LEAVE_ROOM},${this.room}`
      this.sendCtrlData(mesg)

      Rx.Observable.timer(100).subscribe(resolve)
    })
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
