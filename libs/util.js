const log4js = require('log4js')
const logger = log4js.getLogger('util')

const util = {}

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
  'IDLE': 0,
  'CONNECTING' : 1,
  'CONNECTED' : 2
}

util.timestamp = function() {
  return new Date().toLocaleDateString() + " " + new Date().toTimeString()
}

/**
 * 
 * @param {string} conf_path - /room/:name
 * @param {string} req_path - /room/chat
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

  arrConf.forEach( (conf_chunk, i) => {
    const req_chunk = arrReq[i]
    
    if(conf_chunk.indexOf(":") === 0 && conf_chunk.length > 1) {
      const param = conf_chunk.slice(1)
      ret[param] = req_chunk
    } else if(conf_chunk.lengh > 0 && conf_chunk === req_chunk) {
    } else {
      return false
    }
  })
  return ret
}

module.exports = util