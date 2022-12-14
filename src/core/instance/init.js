/* @flow */

import config from '../config'
import {initProxy} from './proxy'
import {initState} from './state'
import {initRender} from './render'
import {initEvents} from './events'
import {mark, measure} from '../util/perf'
import {initLifecycle, callHook} from './lifecycle'
import {initProvide, initInjections} from './inject'
import {extend, mergeOptions, formatComponentName} from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {
	Vue.prototype._init = function (options?: Object) {
		const vm: Component = this
		// a uid
		vm._uid = uid++

		// 性能检测
		let startTag, endTag
		/* istanbul ignore if */
		if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
			startTag = `vue-perf-start:${vm._uid}`
			endTag = `vue-perf-end:${vm._uid}`
			mark(startTag)
		}

		// a flag to avoid this being observed 标识要不要响应式处理(observe)
		vm._isVue = true
		// merge options 合并options
		if (options && options._isComponent) {
			// optimize internal component instantiation
			// since dynamic options merging is pretty slow, and none of the
			// internal component options needs special treatment.
			initInternalComponent(vm, options)
		} else {
			vm.$options = mergeOptions(
				resolveConstructorOptions(vm.constructor),
				options || {},
				vm
			)
		}
		// vm设置_renderProxy 渲染代理对象
		/* istanbul ignore else */
		if (process.env.NODE_ENV !== 'production') {
			initProxy(vm)
		} else {
			vm._renderProxy = vm
		}
		// expose real self
		vm._self = vm
		initLifecycle(vm) // $parent $root $children $refs 以及将自身添加到父组件的$children中
		initEvents(vm) // 初始化存储事件的属性
		initRender(vm) // 初始化render相关
		callHook(vm, 'beforeCreate') // 触发钩子函数beforeCreate

		initInjections(vm) // resolve injections before data/props 初始话依赖注入的inject
		initState(vm)
		initProvide(vm) // resolve provide after data/props 初始话依赖注入的provide

		callHook(vm, 'created') // 触发钩子函数created

		/* istanbul ignore if */
		if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
			vm._name = formatComponentName(vm, false)
			mark(endTag)
			measure(`vue ${vm._name} init`, startTag, endTag)
		}

		if (vm.$options.el) {
			// 调用了原型的$mount方法 这个方法在runtime中被赋值
			// 内部会调用mountComponent(this, el, hydrating)方法
			// 如果时带编译版本的vue 最终也仍会调用这个方法
			vm.$mount(vm.$options.el)
		}
	}
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
	const opts = vm.$options = Object.create(vm.constructor.options)
	// doing this because it's faster than dynamic enumeration.
	const parentVnode = options._parentVnode
	opts.parent = options.parent
	opts._parentVnode = parentVnode

	const vnodeComponentOptions = parentVnode.componentOptions
	opts.propsData = vnodeComponentOptions.propsData
	opts._parentListeners = vnodeComponentOptions.listeners
	opts._renderChildren = vnodeComponentOptions.children
	opts._componentTag = vnodeComponentOptions.tag

	if (options.render) {
		opts.render = options.render
		opts.staticRenderFns = options.staticRenderFns
	}
}

export function resolveConstructorOptions(Ctor: Class<Component>) {
	let options = Ctor.options
	if (Ctor.super) {
		const superOptions = resolveConstructorOptions(Ctor.super)
		const cachedSuperOptions = Ctor.superOptions
		if (superOptions !== cachedSuperOptions) {
			// super option changed,
			// need to resolve new options.
			Ctor.superOptions = superOptions
			// check if there are any late-modified/attached options (#4976)
			const modifiedOptions = resolveModifiedOptions(Ctor)
			// update base extend options
			if (modifiedOptions) {
				extend(Ctor.extendOptions, modifiedOptions)
			}
			options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
			if (options.name) {
				options.components[options.name] = Ctor
			}
		}
	}
	return options
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
	let modified
	const latest = Ctor.options
	const sealed = Ctor.sealedOptions
	for (const key in latest) {
		if (latest[key] !== sealed[key]) {
			if (!modified) modified = {}
			modified[key] = latest[key]
		}
	}
	return modified
}
