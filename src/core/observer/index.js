/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import {arrayMethods} from './array'
import {
	def,
	warn,
	hasOwn,
	hasProto,
	isObject,
	isPlainObject,
	isPrimitive,
	isUndef,
	isValidArrayIndex,
	isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
	shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
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
				// 如果浏览器支持原型 则将数组的原型指向打好补丁的原型
				protoAugment(value, arrayMethods)
			} else {
				// 不支持原型，通过def将打补丁后的原型方法 添加到value中
				copyAugment(value, arrayMethods, arrayKeys)
			}
			// 遍历内部调用observe
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

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
	/* eslint-disable no-proto */
	target.__proto__ = src
	/* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */

/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i]
		def(target, key, src[key])
	}
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
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

/**
 * Define a reactive property on an Object.
 */
export function defineReactive(
	obj: Object, // 观察的对象
	key: string, // key
	val: any, // value
	customSetter?: ?Function,
	shallow?: boolean
) {
	const dep = new Dep()
	// 除了目标对象身上的observer对象会有dep 每个属性也都会创建一个dep对象
	const property = Object.getOwnPropertyDescriptor(obj, key)
	// 如果不可定义操作符 不进行响应式
	if (property && property.configurable === false) {
		return
	}
	// cater for pre-defined getter/setters
	const getter = property && property.get
	const setter = property && property.set
	// 只传递了两个参数时 将val第三个参数补齐
	if ((!getter || setter) && arguments.length === 2) {
		val = obj[key]
	}
	// 子属性的响应式
	let childOb = !shallow && observe(val)
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		get: function reactiveGetter() {
			const value = getter ? getter.call(obj) : val
			// 创建watcher对象时会给Dep.target赋值
			// 创建watcher时 会调用自身的get()方法 这个方法会调用Dep.js文件中的pushTarget()方法 给Dep.target赋值
			// 调用完成后 会调用poptarget() targetStack弹栈 将Dep.target重新赋值为栈顶元素
			if (Dep.target) {
				// 把dep添加到了(Dep.target对应的)watcher里
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
			// 新值和旧值相同 或都是NaN (newVal !== newVal && value !== value)用来判断NaN
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
			// 如果深度监听  则监视新值的属性
			childOb = !shallow && observe(newVal)
			// 新值响应式完成后 通知更新
			dep.notify()
		}
	})
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
	if (process.env.NODE_ENV !== 'production' &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
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
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid adding reactive properties to a Vue instance or its root $data ' +
			'at runtime - declare it upfront in the data option.'
		)
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

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
	if (process.env.NODE_ENV !== 'production' &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
	// 是数组 索引合法 使用修改后的原型方法splice 触发响应式删除
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.splice(key, 1)
		return
	}
	const ob = (target: any).__ob__
	// 如果是vue或_data
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid deleting properties on a Vue instance or its root $data ' +
			'- just set it to null.'
		)
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

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
	for (let e, i = 0, l = value.length; i < l; i++) {
		e = value[i]
		e && e.__ob__ && e.__ob__.dep.depend()
		if (Array.isArray(e)) {
			dependArray(e)
		}
	}
}
