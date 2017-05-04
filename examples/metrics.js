const SiRuDevice = require('../index.js')
const Rx = require('rx')
const os = require('os')
const device = new SiRuDevice('testroom', {ssgaddress: 'localhost'})

device.on('connect', () => {
  device.subscribe('presence')

  device.on('message', (topic, mesg) => {
    device.publish(topic, 'publish:'+mesg)
  })

  device.get('/echo/:mesg', (req, res) => {
    res.send(req.params.mesg)
  })


  device.get('/take/photo', (req, res) => {
    res.setStatus(404).send("???")
  })

  device.post('/take/photo', (req, res) => {
    res.send(`[${Date.now()}] ok`)
  })

  startSendMetrics()
  setTerminate()
})

function setTerminate() {
  process.on('SIGINT', () => {
    device.leaveRoom()
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
      device.publish('raspi205/memory', mem_usage )
      device.publish('raspi205/cpu', cpu_usage )
   })
}
