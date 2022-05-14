# Vue源码初次探索(version: 2.6.14)
## 初始化
### Vue的入口
#### rollup
- Vue项目是使用rollup去打包的(相比于webpack的把所有东西看作模块， rollup更适合用于打包js，适合作为库源码的打包工具)；
#### 入口
- 配置文件中 dev命令对应的配置对象(web-full-dev)
```js
'web-full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
```
- 其中entry 经过处理后(web前缀表示打包的平台 后面的表示入口文件) 对应input 
```js
const resolve = p => {
  const base = p.split('/')[0]
  if (aliases[base]) {
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    return path.resolve(__dirname, '../', p)
  }
}
```
- entry-runtime-with-compiler表示runtime加编译器版本
- 因包含了编译器 所以要重写runtime版本Vue的$mount方法
```ts
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 获取el
  el = el && query(el)
  // el不能是body或者document (<body>或<html>)
  /* ... code */
  const options = this.$options
  // 如果没有传递render函数  则会去找template  (所以如果同时配置了render和template 那么就不会解析template)
  if (!options.render) {
    /*...*/
    if (template) {
        /*...*/
    } else if (el) {
        /*...*/
    }
    if (template) {
        /* ... */
      options.render = render
      options.staticRenderFns = staticRenderFns
    }
  }
  return mount.call(this, el, hydrating)
}
```
- 而在runtime入口中 给Vue添加了和平台相关的全局指令(model show) 和全局组件(transition transition-group) 挂载到了Vue.options上 并将patch和$mount 加到原型上
- runtime的$mount 会在附带编译器的版本被重写
#### 总结
导出Vue的模块
- src/platforms/web/entry-runtime-with-compiler.js
    - web 平台相关的入口
    - 重写了平台相关的 $mount() 方法  (可以编译模板)
    - 注册了 Vue.compile() 方法，传递一个 HTML 字符串返回 render 函数 (将编译器注入)
- src/platforms/web/runtime/index.js
    - web 平台相关
    - 注册和平台相关的全局指令：v-model、v-show
    - 注册和平台相关的全局组件： v-transition、v-transition-group
    - 全局方法：
    - __patch__：把虚拟 DOM 转换成真实 DOM
    - $mount：挂载方法
- src/core/index.js
    - 与平台无关
    - 设置了 Vue 的静态方法，initGlobalAPI(Vue)
- src/core/instance/index.js
    - 与平台无关
    - 定义了构造函数，调用了 this._init(options) 方法
    - 给 Vue 中混入了常用的实例成员
- 顺序: 
    - 入口的平台相关的准备(runtime+compiler版本会额外处理编译器相关)
    - runtime入口
    - core入口
    - 实例入口
    - 实例入口执行 Vue构造函数的定义 添加实例相关的属性和方法
    - core入口执行 添加Vue静态方法
    - runtime入口相关执行 Vue.config 以及将平台相关的组件和指令复制到Vue.options中
    - 入口的平台相关的准备的执行(runtime+compiler版本会额外处理编译器相关 重写$mount实例方法)
- 初始化阶段
    - instance/index 初始化原型属性及方法
    - core/index 初始化静态方法
    - runtime 初始化config 及 v-model v-show全局指令 和 全局组件transition transitionGroup
    - platform重写$mount Vue原型注册__patch__







### Vue初始化静态方法
#### initGlobalAPI src/core/global-api/index.js 注册静态方法
initGlobalAPI这个初始化方法会在src/core/index.js中直接调用initGlobalAPI(Vue) 传入的Vue是下面src/core/instance/index.js 导出的Vue构造函数
```ts
export function initGlobalAPI(Vue: GlobalAPI) {
	// config
	const configDef = {}
	configDef.get = () => config
	Object.defineProperty(Vue, 'config', configDef)
	// 静态方法 set delete nextTick
	Vue.set = set
	Vue.delete = del
	Vue.nextTick = nextTick

	// 2.6 explicit observable API  静态方法 observable
	Vue.observable = <T>(obj: T): T => {
		observe(obj)
		return obj
	}

	// 初始化components directives filters  加s 之后的Vue.component directive filter创建的组件 指令 过滤器会存储到这里
	Vue.options = Object.create(null)
	ASSET_TYPES.forEach(type => {
		Vue.options[type + 's'] = Object.create(null)
	})

	// this is used to identify the "base" constructor to extend all plain-object
	// components with in Weex's multi-instance scenarios.
	// options 中_base就是Vue构造函数
	Vue.options._base = Vue

	// 浅拷贝  将内置组件(KeepAlive)拷贝到options中
	extend(Vue.options.components, builtInComponents)

	initUse(Vue) // Vue.use
	initMixin(Vue) // Vue.mixin
	initExtend(Vue) // Vue.extend 使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。
	initAssetRegisters(Vue) // Vue.('component','directive','filter')
}
```

#### initUse -> Vue.use()
```ts
export function initUse(Vue: GlobalAPI) {
	// use 静态方法 用于安装插件
	Vue.use = function (plugin: Function | Object) {
		// 验证合法性
		// 获取已经安装的插件数组
		const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
		// 如果这个插件已经被安装  不能再次安装
		if (installedPlugins.indexOf(plugin) > -1) {
			return this
		}

		// 将参数转为数组 并将插件去掉 （最后传给插件安装函数的参数是Vue,... 因为使用的是apply）
		const args = toArray(arguments, 1)
		// 添加this(Vue) 将Vue构造函数和插件的参数一起传给插件
		args.unshift(this)
		// 执行插件的install 或直接执行这个函数
		if (typeof plugin.install === 'function') {
			plugin.install.apply(plugin, args)
		} else if (typeof plugin === 'function') {
			plugin.apply(null, args)
		}
		// 安装成功 将他添加到已安装插件中
		installedPlugins.push(plugin)
		return this
	}
}
```

#### initMixin -> Vue.mixin
```ts
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
  	// 将 mixin对象内部的属性拷贝到Vue.options中(@TODO 之后再看mergeOptions)
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
```

#### initExtend -> Vue.extend
```ts
export function initExtend(Vue: GlobalAPI) {
    // ...
	Vue.extend = function (extendOptions: Object): Function {
		extendOptions = extendOptions || {}
		const Super = this
		const SuperId = Super.cid
		/* ... 验证name合法性*/
		// 创建子组件构造函数
		const Sub = function VueComponent(options) {
			this._init(options)
		}
		Sub.prototype = Object.create(Super.prototype)
		Sub.prototype.constructor = Sub
		Sub.cid = cid++
		Sub.options = mergeOptions(
			Super.options,
			extendOptions
		)
		Sub['super'] = Super
        /** 。。。
         * 将Vue的静态方法 及 conmponent directive filter options等 添加到子组件上
         * */
		return Sub
	}
}
```

#### initAssetRegisters -> Vue.component,Vue.directive,Vue.filter
```ts
export function initAssetRegisters(Vue: GlobalAPI) {
	/**
	 * Create asset registration methods.
	 * 'component','directive','filter'
	 * 因为三个函数的参数是相似的  所以会放到一起注册 (id,[definition])
	 */
	ASSET_TYPES.forEach(type => {
		// 遍历 定义静态方法
		Vue[type] = function (
			id: string,
			definition: Function | Object
		): Function | Object | void {
			if (!definition) {
				// 不传定义参数的话 会直接去options中对应的数组中找到相应的'component','directive','filter'
				return this.options[type + 's'][id]
			} else {
				/* istanbul ignore if */
				if (process.env.NODE_ENV !== 'production' && type === 'component') {
					validateComponentName(id)
				}
				// isPlainObject(obj): return _toString.call(obj) === '[object Object]'
				if (type === 'component' && isPlainObject(definition)) {
					// 如果没有name属性 则会给id
					definition.name = definition.name || id
					// 无论this是Vue构造函数 或者是子组件 options._base中保存的是Vue构造函数 这里实际是调用Vue.extend创建子组件
					definition = this.options._base.extend(definition)
				}
				if (type === 'directive' && typeof definition === 'function') {
					// 如果指令传递的是函数  会转换成对象 bind update
					definition = {bind: definition, update: definition}
				}
				// 保存
				this.options[type + 's'][id] = definition
				return definition
			}
		}
	})
}
```

### Vue初始化实例方法
#### Vue 定义Vue构造函数 src/core/instance/index.js
定义构造函数 初始化实例相关属性和方法
```ts
// Vue 的构造函数
function Vue(options) {
	if (process.env.NODE_ENV !== 'production' &&
		!(this instanceof Vue)
	) {
		warn('Vue is a constructor and should be called with the `new` keyword')
	}
	this._init(options)
}
initMixin(Vue) // 初始化vm的_init方法
stateMixin(Vue) // 初始化$data $props属性 $set $delete $watch方法
eventsMixin(Vue) // $on $once $off $emit
lifecycleMixin(Vue) // _update $forceUpdate $destroy
renderMixin(Vue) // $nextTick _render 以及一些其他与render渲染相关的函数
export default Vue
```
### 首次渲染
#### 执行过程
1. 初始化(实例成员静态成员)
2. new Vue();
3. _init();
    - init(lifecycle ,event, render)
    - 调用callhook(vm, 'beforeCreate') 钩子函数
    - initInjections 初始化inject
    - initState初始化状态(响应式)
        - 初始化props
        - 初始化methods
        - 初始化data
            - initData() data是function时 先执行data 保存到vm._data中
            - observe()
        - 初始化computed
        - 初始化watch
    - initProvide 初始化provider
    - 调用created钩子函数
4. vm.$mount();
    1. entry-runtime-with-compiler 带编译版本$mount
    2. 没有传递render时 compileToFunctions生成render options.render = render
    3. 最终与runtime版本的相似 仍会调用mountComponent()
    ```ts
    const mount = Vue.prototype.$mount
    Vue.prototype.$mount = function (
        el?: string | Element,
        hydrating?: boolean
    ): Component {
        // 获取el
        el = el && query(el)
        const options = this.$options
        // resolve template/el and convert to render function
        // 如果没有传递render函数  则会去找template  (所以如果同时配置了render和template 那么就不会解析template)
        if (!options.render) {
            let template = options.template
            if (template) {
                if (typeof template === 'string') {
                    if (template.charAt(0) === '#') {
                        template = idToTemplate(template)
                    }
                } else if (template.nodeType) {
                    template = template.innerHTML
                } else {
                }
            } else if (el) {
                template = getOuterHTML(el)
            }
            if (template) {
                const {render, staticRenderFns} = compileToFunctions(template, {
                    outputSourceRange: process.env.NODE_ENV !== 'production',
                    shouldDecodeNewlines,
                    shouldDecodeNewlinesForHref,
                    delimiters: options.delimiters,
                    comments: options.comments
                }, this)
                options.render = render
                options.staticRenderFns = staticRenderFns
            }
        }
        return mount.call(this, el, hydrating)
    }
    ```
5. vm.$mount() 
    1. runtime版本 mountComponent();
6. mountComponent(this, el,...)
    1. instance/lifecycle
    2. 触发beforeMount钩子函数
    3. 定义updateComponent() 函数中有
        1. vm._update(vm._render,...);
        2. vm._render()渲染虚拟dom
        3. vm._update() 更新 将vdom转换为真实dom
    4. new Watcher() 将updateComponent 传入 
    // watcher 有三种 渲染watcher 侦听器watcher 计算属性watcher
    5. 触发mounted钩子
    6. return vm
7. watcher.get()
    1. 构造器中lazy为false时调用this.get(); 将Dep.target设置为自身(watcher)  this添加到targetStack栈中
    2. 调用传入的updateComponent方法 里面是vm._update(vm._render(), hydrating)
    ```ts
        value = this.getter.call(vm, vm)
    ```
    3. 触发属性get方法 进行依赖收集
    3. popTarget()弹栈


### 响应式原理
#### observe方法 将目标对象转化为响应式
- _init() 中 initState() -> initData() -> observe();
- 
```ts
function observe(value: any, asRootData: ?boolean): Observer | void {
	if (!isObject(value) || value instanceof VNode) {
		return
	}
	let ob: Observer | void
	// 如果对象已经是响应式的 直接返回 (根据__ob__来判断 __ob__中存储了observer对象)
	if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
		ob = value.__ob__
	} else if (
		shouldObserve &&
		!isServerRendering() &&
		(Array.isArray(value) || isPlainObject(value)) &&
		Object.isExtensible(value) &&
		!value._isVue
	) {
		// 如果对象是数组 或 普通js对象 且不是Vue实例 等条件 将对象转化为响应式后返回
		ob = new Observer(value)
	}
	if (asRootData && ob) {
		ob.vmCount++
	}
	return ob
}
```
- Observer类 observer对象初始化时将自身绑定到了目标对象的__ob__属性上 且每一个observer对应了一个dep对象
```ts
class Observer {
	value: any;
	dep: Dep;
	vmCount: number; // number of vms that have this object as root $data
	constructor(value: any) {
		this.value = value
		this.dep = new Dep() // 每一个响应式对象 都对应了一个dep对象
		this.vmCount = 0
		// 将ob对象添加到目标对象上 且设置为不可枚举
		def(value, '__ob__', this)
		if (Array.isArray(value)) {
			if (hasProto) {
				protoAugment(value, arrayMethods)
			} else {
				copyAugment(value, arrayMethods, arrayKeys)
			}
			this.observeArray(value)
		} else {
			// 调用walk 遍历对象的属性 进行响应式处理
			this.walk(value)
		}
	}
	/**
	 * Walk through all properties and convert them into
	 * getter/setters. This method should only be called when
	 * value type is Object.
	 */
	walk(obj: Object) {
		const keys = Object.keys(obj)
		for (let i = 0; i < keys.length; i++) {
			defineReactive(obj, keys[i])
		}
	}
	/**
	 * Observe a list of Array items.
	 */
	observeArray(items: Array<any>) {
		for (let i = 0, l = items.length; i < l; i++) {
			observe(items[i])
		}
	}
}
```

- defineReactive中的defineProperty
```ts
Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
        const value = getter ? getter.call(obj) : val
        if (Dep.target) {
            dep.depend()
            if (childOb) {
                childOb.dep.depend()
                if (Array.isArray(value)) {
                    dependArray(value)
                }
            }
        }
        return value
    },
    set: function reactiveSetter(newVal) {
        const value = getter ? getter.call(obj) : val
        /* eslint-disable no-self-compare */
        if (newVal === value || (newVal !== newVal && value !== value)) {
            return
        }
        /* eslint-enable no-self-compare */
        if (process.env.NODE_ENV !== 'production' && customSetter) {
            customSetter()
        }
        // #7981: for accessor properties without setter
        if (getter && !setter) return
        if (setter) {
            setter.call(obj, newVal)
        } else {
            val = newVal
        }
        childOb = !shallow && observe(newVal)
        dep.notify()
    }
})
```

#### 响应式过程
- 响应式过程
    - observe()
    - new Observer(value)
    - value 添加__ob__属性(observer对象)
    - 此时value:{a:2,..., __ob__:{dep:...,value,vmCount:...} }
    - 调用walk() 遍历key 调用defineReactive
    - defineReactive() 
        - 创建dep(针对属性)
        - 属性的响应式observe()
        - defineProperty()

#### 收集依赖过程
- 收集依赖过程
    - vm.$mount() 方法调用的mountComponent()中 创建了 渲染watcher实例
    - 如果是计算属性watcher 或 侦听器watcher 会在init时创建
    - 而如果都不是 就不会触发getter 或 由用户触发getter Dep.target为空
        - 就是普通的响应式对象 没有对应watcher 其dep的subs为空数组
    - watcher.get();
        - pushtarget(this), 将watcher压栈
        - Dep.target赋值
    - 调用getter( 就是调用updateComponent()) (vm._update(vm.render(),...))
        - _render() 主要是调用用户传入的render 或者模板编译生成的render
            - render.call(vm._renderProxy, vm.$createElement)
            - 如果是编译器版本
            - 校验合法性
            - 进入vm劫持的proxy 返回_data中的值 触发属性的get方法
            - 判断Dep.target是否有值
                - depend()
                    - addDep watcher将dep保存 如果已经保存过了不在重复保存
                        - addSub dep将watcher添加到subs中
            - _v(_s(a))     _s->toString    _v-> 创建文本Vnode
    - 大概理解：在响应式之后（添加对应的getter和setter） 在进行依赖收集时 指定对应的watcher（watcher实例化时 将自身添加到Dep的target中， 同时也会在new时传入的更新视图函数updateComponent保存） 触发对应属性的getter， 然后由getter将watcher自身添加到subs数组中（收集依赖），同时watcher也会知道自己被添加到哪个dep中 防止重复添加  如果有子对象 childOb会收集子属性的依赖

#### 通知变更        
- 通知变更
    - 在收集依赖完成后
    - 如果触发了响应式数据的setter，触发了dep.notify()
    - notify()
        - 克隆subs数组
        - 遍历subs调用内部watcher.update()方法
        - 调用queueWatcher(this)
        - 有个has对象 用来保存watcher的状态（Record<watcherId,status> 如果status为空 说明watcher没有被处理 进入时立即置为true）
        - 有flushing状态 表示是否处于刷新状态
            -  如果处于刷新状态 就不能直接将watcher添加到队列中，而是根据id的大小以及已经执行完的id号，判断插入到哪里 （队列是有序的 按照watcherId排序）
        - waiting 表示是否处于等待状态
        - 生产环境下 将刷新队列方法flushSchedulerQueue交给nextTick调用;
            - 刷新方法flushSchedulerQueue 首先会对队列进行排序
            ```js
            /**
             * 原因：
                1. 父组件更新将在子组件之前(因为父组件先创建)
                2. 组件中 用户定义的watcher时在渲染watcher之前定义的(watcher在initState中定义，渲染watcher在mountComponent时定义)
                3. 如果一个组件在父组件watcher期间 子组件销毁了 那么子组件的watcher就可以跳过
             * /
            ```
            - 遍历每个watcher 
                - 首先触发beforeUpdate钩子
                - 将has对应id 置为null 否则下一次触发改watcher时将不会正常运行
                - 调用watcher的run()方法
                    - 确保watcher是存活的 (有可能因为父组件触发的watcher 将子组件销毁了 子组件仍然会执行watcher)
                    - 调用get()方法（这里的get就是实例化watcher传入的函数 渲染watcher传入的是updateComponent）
                    - 如果get方法有返回值 判断新旧值是否相同 (updateComponent没有返回值)
                    - 如果不同 调用传入的callback
                - 完成后 页面上已经可以看到最新数据了(如果是渲染watcher)
                - 重置状态 （waiting和flushing为false has对象为空对象）
                - 触发actived钩子
                - 触发updated钩子

#### array的响应式
- array响应式 重新创建一份Array的原型对象 这个原型对象的原型保存的是原先的原型
```ts
    const arrayProto = Array.prototype
    export const arrayMethods = Object.create(arrayProto)
    // 获取Array的原型 方便后面进行修改
    // 要修改的方法
    const methodsToPatch = [
        'push',
        'pop',
        'shift',
        'unshift',
        'splice',
        'sort',
        'reverse'
    ]
    methodsToPatch.forEach(function (method) {
        // cache original method
        // 遍历要修改的方法 给每个方法打补丁
        const original = arrayProto[method]
        def(arrayMethods, method, function mutator(...args) {
            // 将数组方法变更 通过触发原来的方法拿到最新数据
            const result = original.apply(this, args)
            const ob = this.__ob__
            let inserted
            // push unshift是插入的方法 通过参数可以获取的插入的元素
            // splice 如果有三个以上参数, 则第三个以后的参数都是新增的元素
            // 获取到插入的数据 对其进行observe
            switch (method) {
                case 'push':
                case 'unshift':
                    inserted = args
                    break
                case 'splice':
                    inserted = args.slice(2)
                    break
            }
            if (inserted) ob.observeArray(inserted)
            // notify change 通知改变
            ob.dep.notify()
            return result
        })
    })

```
- 响应式处理时 new Observer()中 判断如果是数组 则会将这个数组的原型__proto__指向这个新原型对象(浏览器不支持proto时则通过def 将方法定义到数组身上)
```ts
    // 如果浏览器支持原型 则将数组的原型指向打好补丁的原型
    protoAugment(value, arrayMethods)
    function protoAugment(target, src: Object) {
        target.__proto__ = src
    }
```


#### Vue.set || vm.$set
- 静态方法与实例方法相同
- set(target: Array<any> | Object, key: any, val: any): any
```ts
function set(target: Array<any> | Object, key: any, val: any): any {
	// 判断是否是数组 且 索引合法
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		// 如果输入的key超过最大长度 采取的措施
		target.length = Math.max(target.length, key)
		// 调用经过替换后的原型方法splice 将指定key的值替换 使用已经过处理的原型方法实现的响应式处理
		// 先获取的插入的值 并对插入的值进行响应式处理  然后触发notify
		target.splice(key, 1, val)
		return val
	}
	// 判断key 是否在对象身上  且key不属于原型对象
	if (key in target && !(key in Object.prototype)) {
		target[key] = val
		return val
	}
	// key原先不在对象身上
	// 获取原先的ob对象
	const ob = (target: any).__ob__
	// 如果是vue实例 或 是否是$data（_data 实例化时initData() 会将data的ob对象 ob.vmCount++ 所以data的ob是1 其他ob为0）
	if (target._isVue || (ob && ob.vmCount)) {
		// 。。。
		return val
	}
	// 判断是否是响应式对象 不是则直接赋值
	if (!ob) {
		target[key] = val
		return val
	}
	// 如果是响应式对象  则响应式处理  然后notify
	defineReactive(ob.value, key, val)
	ob.dep.notify()
	return val
}
```

#### Vue.delete || vm.$delete
- 因为delete删除属性 触发不了setter
- 响应式的删除一个属性
```ts
function del(target: Array<any> | Object, key: any) {
	// 是数组 索引合法 使用修改后的原型方法splice 触发响应式删除
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.splice(key, 1)
		return
	}
	const ob = (target: any).__ob__
	// 如果是vue或_data
	if (target._isVue || (ob && ob.vmCount)) {
		// ...
		return
	}
	// 对象是否有这个属性
	if (!hasOwn(target, key)) {
		return
	}
	delete target[key]
	// 如果对象是非响应式的 直接返回
	if (!ob) {
		return
	}
	// 触发更新
	ob.dep.notify()
}
```
#### vm.$watch
- watch没有静态实现 因为需要使用到vm（this）
- $watch的添加位置 在初始化时 给Vue的原型上添加了$watch
- watcher有三种 计算属性watcher 用户watcher 渲染watcher
    - 实例化vue时创建watcher时间
    - _init中 initState
    - props => methods => data => computed => watch
    - 先创建computed 然后是watch
    - created后
    - $mount方法 mountComponent 触发beforeMount钩子后创建渲染watcher
- initWatch中(初始化watch属性)
    - 遍历watch 获取到值
    - 如果传入的值是数组 遍历创建watcher（监听的回调函数可以传入数组） createWatcher
    - createWatcher 返回 vm.$watch(expOrFn, handler, options)
    
#### Vue.nextTick || vm.$nextTick
- 数据变更
- 触发setter  notify 
- 遍历触发watcher.update > run > get()updateComponent更新视图 > queueWatcher > 调用nextTick(flushSchedulerQueue) 将flush函数添加到callbacks中 如果不在等待状态中会异步执行callbacks中的回调
- 由用户使用时 将用户传入的cb添加到callbacks中 如果不处于pending 则会异步执行回调
- 如果处于pending 则会等待到下一次视图更新时调用


### vdom
#### 过程
- 更详细的过程 待完善
- updateComponent()中
- vm._render() 调用render函数（可以是用户传入的 也可以是模板编译后的）
    - 调用_createElement 创建Vnode对象 
    - 处理完后 _render()返回了vnode
- vm._update()
    - 将虚拟 dom渲染为真实dom
    - 调用__patch__()
    - 首次执行时 传入的是__patch__(vm.$el, vnode, hydrating, false)真实dom
    - 数据更新是__patch__(preVnode, vnode)传入的是两个vnode

- vm.__patch__() 挂载到原型上的patch方法
    - 是经过平台化处理后的函数
    - 原先是有runtime/patch 导出的patch
    - 经过平台相关处理 添加平台操作dom的方法后
    - 调用createPatchFunction() 返回的patch
- patch()函数
    - 挂载了cbs  处理节点的属性/事件/样式操作的钩子函数
    - 判断是否真实dom 是的话要首先转换为vnode 调用createElm
    - 数据更新时 如果新旧节点sameVnode 则需要执行patchVnode
    - 删除旧节点



#### 列表使用key和不使用key的区别
- 例子 ['a','b','c','d'] => ['a','x','b','c','d']
    - 每个元素用li包裹
- 不使用key
    - 在判断是否为相同Vnode时
    ```ts
    function sameVnode (a, b) {
    return (
        // key相同 且 标签名相同  如果不设置key 判断为真 需要进行patchVnode详细比较
        a.key === b.key &&
        a.asyncFactory === b.asyncFactory && (
            (
                a.tag === b.tag &&
                a.isComment === b.isComment &&
                isDef(a.data) === isDef(b.data) &&
                sameInputType(a, b)
            ) || (
                isTrue(a.isAsyncPlaceholder) &&
                isUndef(b.asyncFactory.error)
            )
        )
    )
    }
    ```
    - 经过patchVnode 将差异进行比较发现内部节点不同 然后会重新渲染这个节点
    - 如果向一个列表最开头添加一个数据 那么整个列表的视图都需要重新渲染
- 使用key
    - 在比较到b与x对应的li时 因key不同 所以oldstartVnode 和 newstartVnode判断不是同个节点
    - 转而比较oldEndVnode, newEndVnode 判断为相同 进行patchVnode 比较内部差异
    - 所以在渲染完成后 abcd仍然使用的是原先的node
    - 而不使用key时  渲染完后 bcd都不是原先的node了