/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import {def} from '../util/index'

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
/**
 * Intercept mutating methods and emit events
 */
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
