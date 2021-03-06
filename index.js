const { green, blue, red } = require('chalk')
const debug = require('debug')('jsr:router')
const glob = require('glob')
const jsonServer = require('json-server')
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const express = require('express')
const rewrite = require('express-urlrewrite')
const jph = require('json-parse-helpfulerror')
const opn = require('opn')

/**
 * 传入opts
 * @param { Object } opts { root: 'src', port: 3000, publicPath: 'public',open:true }
 * @description
 * root mock 文件所在目录 默认值 'mock'
 * port app 端口号需要跟json-server端口号一致 默认值 3000
 * publicPath 生成首页的路径 默认 'public'
 * open 默认打开浏览器 默认true
 */
class JsonServerRouter {
  constructor (opts = {}) {
    this.opts = opts
    this.opts.root = path.resolve(this.opts.root)
    debug(this.opts)
    this.routeStore = []
    this.$IsInit = true
    this._init()
  }
  get routeSources () {
    const { root } = this.opts

    return glob.sync(`${root}/**/*.{js,json}`)
  }
  _init () {
    let { root, publicPath, port, open, host } = this.opts

    const templateStore = []
    try {
      fs.statSync(path.resolve(root))
    } catch (error) {
      console.info(red('no such file or directory'), red(path.resolve(root)))
      process.exit(0)
    }

    this.routeSources.forEach(filePath => {
      const prefix = filePath
        .replace(/\.(js|json)$/, '')
        .replace(/\/index$/, '')
        .replace(root, '')
      /**
       * @var {Object} routes josn-server 路由对象
       * @description
       *  const routes = require(path.resolve(filePath))
       *  上面的写法会走缓存，如果文件以及修改了变拿不到新值
       */

      delete require.cache[filePath]
      const routes = require(filePath)

      this.routeStore.push(new PartRouter(routes, prefix))
      logDebugInfo(filePath, routes, prefix)
      templateStore.push(new PartTemplate(routes, prefix, filePath).render())
    })
    if (fs.existsSync(publicPath)) {
      // fs.ensureDirSync(publicPath)
      createTemlate(templateStore, publicPath)

      open && opn(`http://localhost:${port}/`)
    }
  }
  // 单纯为了跟koa-router 接口一样
  routes () {
    return (req, res, next) => {
      const app = req.app
      if (this.$IsInit) {
        const compareRegex = /\//g
        this.routeStore.sort(function (x, y) {
          return (
            x.prefix.match(compareRegex).length -
            y.prefix.match(compareRegex).length
          )
        })

        this.routeStore.reverse().forEach(partRouter => {
          partRouter.getRoutes(app)
        })
        // app.use(this.rewrite()) 没起效在外面调用起效了why?
        this.$IsInit = false
      }
      next()
    }
  }

  rewrite () {
    let { root } = this.opts
    const router = express.Router()
    glob.sync(`${root}/**/index.{js,json}`).forEach(filePath => {
      let prefix = path.parse(filePath.replace(root, '')).dir
      // 匹配 /books 或者 /books?xx
      let prefixReg = new RegExp(`(${prefix}\\?[^?/]*)|(^${prefix}$)`)
      router.use(rewrite(prefixReg, `${prefix}/index`))
    })

    return router
  }
}
function logDebugInfo (filePath, routes, prefix) {
  debug(blue('file'), green(filePath))
  for (let key in routes) {
    debug(blue(`${prefix}/${key}`))
  }
}
/**
 *
 * @param {object} routes  当前文件输出JavaScript object
 * @param {string} prefix  路由前缀
 */
function PartRouter (routes, prefix) {
  this.prefix = prefix
  this.routes = routes
  this.getRoutes = app => app.use(`${prefix}`, jsonServer.router(routes))
}
function PartTemplate (routes, prefix, filePath) {
  const arr = []
  this.render = () => {
    arr.push(
      ` <h3 class="bg-primary">${prefix} <span class="glyphicon glyphicon-file" aria-hidden="true"></span> <span class="h6" >${filePath}</span></h3>`
    )
    arr.push(`<ul>`)
    for (let key in routes) {
      let uri = `${prefix}/${key}`.replace(/\/index$/, '')
      arr.push(`<li> <a href="${uri}">${uri} </a></li>`)
    }
    arr.push(`</ul>`)
    return arr.join('\n')
  }
}
function createTemlate (templateStore, publicPath) {
  const _template = fs.readFileSync(path.join(__dirname, '_template.html'))
  fs.writeFileSync(
    path.join(publicPath, 'index.html'),
    _.template(_template)({ body: templateStore.join('\n') })
  )
}
module.exports = JsonServerRouter
