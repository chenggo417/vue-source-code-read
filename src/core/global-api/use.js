/* @flow */

import {toArray} from '../util/index'

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
