const fs = require('fs')
const readline = require('readline')
const FILENAME = __dirname + '/metrics.csv'

const file = fs.readFileSync(FILENAME)

const hour = parseInt(process.argv[2]) || 1 // default is one hour

const rs = fs.ReadStream(FILENAME)


function getMetrics(hour) {
  const _hour = parseInt(hour) || 1
  const rl = readline.createInterface({'input': rs, 'output': {}});
  const from = Date.now() - _hour * 3600 * 1000
  const ret = []

  return new Promise((resolv, reject) => {
    rl.on('line', function (line) {
      try {
        const arr = line.split(",")
        const ts = parseInt(arr[0])
        if( ts > from ) {
          const obj = JSON.parse(arr.slice(1).join(","))
          ret.push(Object.assign({}, obj, {timestamp: ts}))
        }
      } catch(err) {
        rl.close()
        reject(err)
      }
    });

    rl.on('pause', () => {
      rl.close()
      resolv(ret)
    })
  })
}

module.exports = getMetrics

// test
getMetrics().then(res => console.log(res))
