class Request {
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

    this.payload = param.data.payload
    this.method  = param.data.payload.method
    this.query   = param.data.payload.query
    this.params  = {}
    this.body    = param.data.payload.body
    this.transaction_id = param.data.payload.transaction_id
    this.path    = param.data.payload.path
  }
}

module.exports = Request
