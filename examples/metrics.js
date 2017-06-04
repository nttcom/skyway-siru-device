const SiRuDevice = require('../index.js')
const Rx   = require('rx')
const os   = require('os')
const fs   = require('fs')
const yaml = require('js-yaml')

const conf = yaml.safeLoad(fs.readFileSync(__dirname + '/metrics.yaml'))
const device = new SiRuDevice(conf.roomname, {ssgaddress: conf.ssgaddress})
const getMetrics = require('./get_metrics')


const device_name = 'raspi205'

const TEMP_FILE = '/sys/class/thermal/thermal_zone0/temp'

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

  device.get('/length/:length', (req, res) => {
    const len = parseInt(req.params.length)
    res.send(new Array(len + 1).join("a"))
  })

  device.get('/metrics/:hour', (req, res) => {
    getMetrics(req.params.hour)
      .then(metrics => {
        res.send(metrics)}
      )
      .catch(err => {
        res.setStatus(403).send(err.toString())
        console.warn(err)
      })
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
      device.publish( device_name + '/memory', mem_usage )
      device.publish( device_name + '/cpu', cpu_usage )

      storeBucket( device_name + '/memory'.replace('/', '_'), mem_usage)
      storeBucket( device_name + '/cpu'.replace('/', '_'), cpu_usage)

      // publish system temperature
      fs.readFile(TEMP_FILE, (err, data) => {
        if(err) {
          console.warn(err.toString());
        } else {
          const temperature = JSON.stringify({
            "cpu": parseInt(data) / 1000
          })
          device.publish( device_name + '/temperature', temperature );
          storeBucket( device_name + '/temperature'.replace('/', '_'), temperature)
        }
      })
   })
}


const buckets = {}
const INTERVAL = 60
const FILENAME = 'metrics.csv'

function storeBucket( topic, json_str ) {
  try {
    const json = JSON.parse(json_str)

    if(!buckets[topic]) buckets[topic] = {} // initialize for the topic

    const bucket = buckets[topic]

    for(var key in json) {
      if(!bucket[key]) bucket[key] = []  // initalize for the property
      bucket[key].push(json[key])
      if(bucket[key].length > INTERVAL) bucket[key].shift()
    }
  } catch(err) {
    console.warn(err)
  }
}



Rx.Observable.interval(INTERVAL * 1000)
  .subscribe(() => {
    const avg = {}

    for(var key in buckets) {
      var bucket = buckets[key]
      avg[key] = {}
      for(var prop in bucket) {
        var len = bucket[prop].length
        var sum = 0;
        for( var i = 0; i < len; i++) sum = sum + bucket[prop][i]
        var _avg = sum / len

        avg[key][prop] = _avg
      }
    }
    const out = `${Date.now()},${JSON.stringify(avg)}\n`
    fs.writeFile(FILENAME, out, {flag:'a'})
  })
