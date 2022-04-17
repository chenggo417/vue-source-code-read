/* @flow */

import {ASSET_TYPES} from 'shared/constants'
import {isPlainObject, validateComponentName} from '../util/index'

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
