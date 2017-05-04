# SiRu-device

SkyWay IoT SDK room utility for device

## snipet


```javascript
const siru = new SiRuDevice('myroom')

siru.on('connect', () => {
  siru.subscribe('presence')

  siru.publish('presence', `${siru.myid}: hello world.`)
})

siru.get('/echo/:message', (req, res) => {
  res.send(req.params.message)
})

```

