const SiRuDevice = require('../index.js')
const Rx   = require('rx')
const os   = require('os')
const fs   = require('fs')
const yaml = require('js-yaml')

const conf = yaml.safeLoad(fs.readFileSync(__dirname + '/metrics.yaml'))
const device = new SiRuDevice(conf.roomname, {ssgaddress: conf.ssgaddress})


const device_name = 'yourdevice'
const TEMP_FILE = '/sys/class/thermal/thermal_zone0/temp'

device.on('connect', () => {
  device.get('/echo/:mesg', (req, res) => res.send(req.params.mesg))

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
      device.publish( device_name + '/memory', mem_usage )
      device.publish( device_name + '/cpu', cpu_usage )

      // publish system temperature
      fs.readFile(TEMP_FILE, (err, data) => {
        if(err) {
        } else {
          const temperature = JSON.stringify({
            "cpu": parseInt(data) / 1000
          })
          device.publish( device_name + '/temperature', temperature );
        }
      })
   })
}

