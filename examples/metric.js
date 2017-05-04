const skEmbed = require('../index.js')
const Rx = require('rx')
const os = require('os')
const sk_embed = new skEmbed('testroom', {ssgaddress: '10.49.52.205'})

sk_embed.on('connect', () => {
  sk_embed.subscribe('presence')

  sk_embed.on('message', (topic, mesg) => {
    sk_embed.publish(topic, 'publish:'+mesg)
  })

  sk_embed.get('/echo', (req, res) => {
    res.send(req.body)
  })
  sk_embed.get('/echo/:mesg', (req, res) => {
    res.send(req.params.mesg)
  })
  startSendMetrics()
  setTerminate()
})

function setTerminate() {
  process.on('SIGINT', () => {
    sk_embed.leaveRoom()
      .then(() => process.exit())
  });
}

function startSendMetrics() {
  const sendMetricTimer = Rx.Observable.interval(1000)
    .subscribe(() => {
      const freemem  = os.freemem();
      const totalmem = os.totalmem();
      const loadavg  = os.loadavg();

      const mem_usage = JSON.stringify({
        "free": freemem,
        "total": totalmem,
        "used": totalmem - freemem
      })

      const cpu_usage = JSON.stringify({
        "1min": loadavg[0],
        "5min": loadavg[1],
        "15min": loadavg[2]
      })

      // publish usage of memory and cpu
      sk_embed.publish('raspi205/memory', mem_usage )
      sk_embed.publish('raspi205/cpu', cpu_usage )
   })
}