const log4js = require('log4js')
const logger = log4js.getLogger('util')

const util = {}

util.QUEUE_SEND_INTERVAL=50  // 50msec

util.JOIN_ROOM = 'SSG:room/join'
util.LEAVE_ROOM = 'SSG:room/leave'
util.PROFILE_URL = (addr, port) => {
  return `http://${addr}:${port}/profile`
}
util.HANDLER =
{
  CONTROL_ID:   new Buffer('0000000000000000', "hex"),
  BROADCAST_ID: new Buffer('FFFFFFFFFFFFFFFF', "hex")
}

util.STATUS = {
  'IDLE'        : 0,
  'CONNECTING'  : 1,
  'CONNECTED'   : 2,
  'RECONNECTING': 3,
  'RECONNECTED' : 4,
  'CLOSED'      : 9
}

util.ROOMSTATUS = {
  'JOINED': 0,
  'LEAVED': 1
}

util.timestamp = function() {
  return new Date().toLocaleDateString() + " " + new Date().toTimeString()
}

/**
 * check request path matches with configured path.
 * if it matches, this func will return params object otherwise return false
 *
 * @param {string} conf_path - path configured ( e.g. `/room/:name` )
 * @param {string} req_path  - request path    ( e.g. `/room/chat` #=> `{name: "chat"}` )
 */
util.check_path = function(conf_path, req_path){
  const arrConf = conf_path.split("/")
  const arrReq  = req_path.split("/")

  let ret = {}

  if(arrConf.length === 1 || arrReq.length === 1) {
    return false
  }

  if(arrConf.length !== arrReq.length) {
    return false
  }

  for(var i = 0, len = arrConf.length; i < len; i++) {
    var conf = arrConf[i], req = arrReq[i]

    if(conf.indexOf(":") === 0 && conf.length > 1) {
      const key = conf.slice(1)  // to obtain key name, we'll remove `:`
      ret[key] = req
    } else if( conf === req) {
    } else {
      return false
    }
  }

  return ret
}

module.exports = util
