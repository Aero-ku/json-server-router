const jsonServer = require('json-server')
const fs = require('fs')
const { blue, red, green } = require('chalk')
const JsonServerRouter = require('../index')

/**
 * @prop {string} root mock文件根目录默认为 'mock'
 * @prop {number} port 端口号跟json-server 一致
 * @prop {string} publicPath 生成默认首页的地址，跟json-server 一致默认为 'public'
 */

module.exports = function createServer (opts) {
  const {
    root,
    host,
    port,
    open,
    simple,
    static: publicPath,
    handler,
    queryMap
  } = opts
  const middlewares = jsonServer.defaults({
    bodyParser: true,
    static: publicPath
  })
  const app = jsonServer.create({ port, host })
  const router = new JsonServerRouter({
    root,
    host,
    port,
    open,
    publicPath
  })

  app.use(middlewares)

  const jsrPrefix = fs.existsSync(publicPath) ? `/jsr` : '/'

  app.get(jsrPrefix, function (req, res) {
    res.jsonp(router.routeStore)
  })

  app.use(function (req, res, next) {
    queryMap.forEach(([_key, key]) => {
      req.query[_key] = req.query[key]
    })
    next()
  })

  app.put('*', handler)
  app.delete('*', handler)
  app.post('*', handler)
  app.use(router.rewrite())
  app.use(router.routes())

  const server = app.listen(port, () => {
    console.info(green(`❤️  visit `), blue(`http://localhost:${port}/`))
    console.info(green(`❤️  visit `), blue(`http://${host}:${port}/`))
    console.info(blue('输入rs重新启动mock server'))
  })
  process.on('uncaughtException', error => {
    if (error.errno === 'EADDRINUSE') {
      console.log(
        red(
          `Cannot bind to the port ${
            error.port
          }. Please specify another port number either through --port argument or through the jsr.config.js configuration file`
        )
      )
    } else console.log('Some error occurred', error)
    process.exit(1)
  })
  // http://www.html-js.com/article/The-correct-method-of-HTTP-server-nodejs-scrap-off-in-nodejs
  const sockets = []
  server.on('connection', function (socket) {
    sockets.push(socket)
    socket.once('close', function () {
      sockets.splice(sockets.indexOf(socket), 1)
    })
  })

  server.closeServer = () => {
    sockets.forEach(function (socket) {
      socket.destroy()
    })
    server.close(function () {})
  }
  return server
}
