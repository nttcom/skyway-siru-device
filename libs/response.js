const log4js = require('log4js')
const access_log = log4js.getLogger('access-log')
const util = require('./util')

class Response {
  /**
   *
   * @param {object} param
   * @param {object} parent  - skEmbed instance
   */
  constructor(param, parent) {
    // fixme: validation
    this.parent = parent
    this.uuid   = param.data.topic
    this.handle_id = param.handle_id

    this.payload        = param.data.payload
    this.method         = param.data.payload.method
    this.transaction_id = param.data.payload.transaction_id
    this.path           = param.data.payload.path
    this._status         = 200
    this.begin          = Date.now()
  }

  get status() {
    return this._status
  }

  /**
   * @params {number} code - status code
   */
  set status(code) {
    this._status = code // 200, 500, etc
  }

  setStatus(code) {
    this._status = code

    return this
  }


  /**
   *
   * @param {string|object} data
   */
  send(data) {
    const norm_data = {
      topic: this.uuid,
      payload: {
        'status': this._status,
        'method': this.method,
        'transaction_id': this.transaction_id,
        'body': data
      }
    }
    this.parent.send(this.handle_id, norm_data)
    access_log.info(this.logmesg(norm_data.payload.body.length))
  }

  logmesg(len) {
    const diff = Date.now() - this.begin
    return `[${util.timestamp()}] "${this.method.toUpperCase()} ${this.path}" ${this.status} ${len} ${diff}`
  }
}

module.exports = Response
