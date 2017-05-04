# Skyway-PubSub

Virtual PubSub library leveraging SkyWay [PaaS](http://nttcom.github.io/skyway/en/)

It will bring you **cost reducted** and **rapid** PubSub service. Since it is on top of full-mesh P2P connection among clients (No relay server).

## snipet

**browser**

```javascript
// obtain APIKEY from skyway.io. Don't forget to config your domain in APIKEY setting.
const client = new skPubSub('myroom', {key: 'YOUR_API_KEY', origin: 'YOUR_DOMAIN'}) 

client.on('connect', () => {
  console.log("connection established for skPubSub")
  client.subscribe('presence')

  setTimeout( ev => {
    client.publish('presence', `${client.myid}:hello world.`)
  }, 3000)
})

client.on('message', (topic, mesg) => {
  console.log(mesg)
})

client.fetch('/temeperature')
  .then(data => { ... })
```

**embed device**

```javascript
const sk_embed = new skEmbed('myroom')

sk_embed.on('connect', () => {
  sk_embed.subscribe('presence')

  sk_embed.publish('presence', `${sk_embed.myid}: hello world.`)
})

sk_embed.createServer( (req, res) => {
  res.send("hogehoge")
})

```

## publish, subscribe, send

**subscribe(topic)**

```
@property {string} topic - topic name
```

```javascript
client.subscribe('presence')
```

**publish(topic, data)**

```
@property {string} topic - topic name
@property {object|string} data - arbitrary data
```

```javascript
client.publish('presence', "hello world")
```

**send(uuid, data)**

```
@property {string} uuid - uuid of device
@property {object|string} data - arbitrary data
```

```javascript
client.send(uuid, "hello")
```

**Event:'message'**

When message from published topic or device as a response of `send()` received, `message` event will be fired.

```javascript
client.on('message', (topic, data) => {
  // topic will be subscribed topic or uuid of target device
  // data will be object or string.
})
```



## automatically getting meta data

skPubSub will automatically get peer device's meta data after `connect`. When it received, event will be emitted as follows. As shown in below snipet, you can request video streaming with `requestStreaming` and receive sensor metrics using `subscribe`

```javascript
client.on('stream', stream => {display(stream)})

client.on('meta', data => {
  // start monitoring video stream from device
  if(data.streaming.enable) client.requestStreaming(data.uuid)

  // start monitoring sensor metrics from device
  data.topics.forEach(topic => this.client.subscribe(topic.name))
})
```

The format of meta data is shown below

```
@property {string} name      - name of this device
@property {string} uuid      - uuid of this device
@property {object} streaming - streaming data object
@proeprty {boolean} streaming.enable - when this is true, this device supports video streaming
@property {object[]} topics - topics for metrics
@property {string} topic.name  - name of topic
@property {string} topic.title - title name of metric
@property {string} topic.type  - format of metric, json, string or number
@property {object[]} topic.properties      - if type is 'json', this array explains each property
@property {string}   topic.property.name   - name of property
@property {type}     topic.propety.type    - type of property (string or number)
@property {string}   topic.property.string - description of property
```

* example

```json
{
  "name": "raspi205",
  "uuid": "3f6f6873-8191-44d9-a229-bb652884dd61",
  "streaming": {
    "enable": true
  },
  "topics": [
    {
      "name": "3f6f6873-8191-44d9-a229-bb652884dd61/temperature",
      "title": "cpu temperature",
      "type": "json",
      "properties": [
        {
          "name": "value",
          "type": "number",
          "description": "current temperature"
        }
      ]
    }
 ]
}
```

## streaming

**requestStreaming(uuid)**

```
@property {string} uuid - uuid of peer device
@promise {object} stream - stream object
```

```javascript
client.requestStreaming(uuid)
  .then(stream => displayVideo(stream))
```

**stopStreaming(uuid)**

```
@property {string} uuid - uuid of peer device
```

```javascript
client.stopStreaming(uuid)
```

