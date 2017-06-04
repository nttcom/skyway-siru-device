# SiRu device

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

# Install

## npm

```bash
$ npm install skyway-siru-device
```

# API reference

* [API reference - SiRu device](https://github.com/nttcom/skyway-iot-sdk/blob/master/docs/apiref/siru_device.md)

---

Copyright. NTT Communications Corporation All Rights Reserved.
