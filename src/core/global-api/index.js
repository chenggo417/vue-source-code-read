/* @flow */

import config from '../config'
import {initUse} from './use'
import {initMixin} from './mixin'
import {initExtend} from './extend'
import {initAssetRegisters} from './assets'
import {set, del} from '../observer/index'
import {ASSET_TYPES} from 'shared/constants'
import builtInComponents from '../components/index'
import {observe} from 'core/observer/index'

import {
	warn,
	extend,
	nextTick,
	mergeOptions,
	defineReactive
} from '../util/index'

export function initGlobalAPI(Vue: GlobalAPI) {
	// config
	const configDef = {}
	configDef.get = () => config
	if (process.env.NODE_ENV !== 'production') {
		configDef.set = () => {
			warn(
				'Do not replace the Vue.config object, set individual fields instead.'
			)
		}
	}
	Object.defineProperty(Vue, 'config', configDef)

	// exposed util methods.
	// NOTE: these are not considered part of the public API - avoid relying on
	// them unless you are aware of the risk.
	// 注意：这些不被视为公共API的一部分 - 避免依赖 除非你意识到风险。
	Vue.util = {
		warn,
		extend,
		mergeOptions,
		defineReactive
	}

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
