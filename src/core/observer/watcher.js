/* @flow */

import {
	warn,
	remove,
	isObject,
	parsePath,
	_Set as Set,
	handleError,
	invokeWithErrorHandling,
	noop
} from '../util/index'

import {traverse} from './traverse'
import {queueWatcher} from './scheduler'
import Dep, {pushTarget, popTarget} from './dep'

import type {SimpleSet} from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
	vm: Component;
	expression: string;
	cb: Function;
	id: number;
	deep: boolean;
	user: boolean;
	lazy: boolean;
	sync: boolean;
	dirty: boolean;
	active: boolean;
	deps: Array<Dep>;
	newDeps: Array<Dep>;
	depIds: SimpleSet;
	newDepIds: SimpleSet;
	before: ?Function;
	getter: Function;
	value: any;

	constructor(
		vm: Component,
		expOrFn: string | Function,
		cb: Function,
		options?: ?Object,
		isRenderWatcher?: boolean
	) {
		// watcher 有三种 渲染watcher 侦听器watcher 计算属性watcher
		// 这里的vm._watchers存储的是所有类型的watcher
		this.vm = vm
		if (isRenderWatcher) {
			vm._watcher = this
		}
		vm._watchers.push(this)
		// options
		if (options) {
			this.deep = !!options.deep
			this.user = !!options.user
			this.lazy = !!options.lazy
			this.sync = !!options.sync
			this.before = options.before
		} else {
			this.deep = this.user = this.lazy = this.sync = false
		}
		this.cb = cb
		this.id = ++uid // uid for batching
		this.active = true
		this.dirty = this.lazy // for lazy watchers
		this.deps = []
		this.newDeps = []
		this.depIds = new Set()
		this.newDepIds = new Set()
		this.expression = process.env.NODE_ENV !== 'production'
			? expOrFn.toString()
			: ''
		// expOrFn 是第二个参数 渲染watcher传入的是updateComponent
		// 如果是用户定义的watch属性watch:{'a.b': function} 则需要通过parsePath获取到对应的值
		// parse expression for getter
		if (typeof expOrFn === 'function') {
			this.getter = expOrFn
		} else {
			this.getter = parsePath(expOrFn)
			if (!this.getter) {
				this.getter = noop
				process.env.NODE_ENV !== 'production' && warn(
					`Failed watching path: "${expOrFn}" ` +
					'Watcher only accepts simple dot-delimited paths. ' +
					'For full control, use a function instead.',
					vm
				)
			}
		}
		// 如果是computedWatcher的话 lazy为true
		this.value = this.lazy
			? undefined
			: this.get()
	}

	/**
	 * Evaluate the getter, and re-collect dependencies.
	 */
	get() {
		// 将Dep.target设置为自身(watcher)  this添加到targetStack栈中
		pushTarget(this)
		let value
		const vm = this.vm
		try {
			// 调用传入的updateComponent方法 里面是vm._update(vm._render(), hydrating)
			value = this.getter.call(vm, vm)
		} catch (e) {
			if (this.user) {
				handleError(e, vm, `getter for watcher "${this.expression}"`)
			} else {
				throw e
			}
		} finally {
			// "touch" every property so they are all tracked as
			// dependencies for deep watching
			if (this.deep) {
				traverse(value)
			}
			popTarget()
			this.cleanupDeps()
		}
		return value
	}

	/**
	 * Add a dependency to this directive.
	 */
	addDep(dep: Dep) {
		const id = dep.id
		if (!this.newDepIds.has(id)) {
			this.newDepIds.add(id)
			this.newDeps.push(dep)
			if (!this.depIds.has(id)) {
				dep.addSub(this)
			}
		}
	}

	/**
	 * Clean up for dependency collection.
	 */
	cleanupDeps() {
		let i = this.deps.length
		while (i--) {
			const dep = this.deps[i]
			if (!this.newDepIds.has(dep.id)) {
				dep.removeSub(this)
			}
		}
		let tmp = this.depIds
		this.depIds = this.newDepIds
		this.newDepIds = tmp
		this.newDepIds.clear()
		tmp = this.deps
		this.deps = this.newDeps
		this.newDeps = tmp
		this.newDeps.length = 0
	}

	/**
	 * Subscriber interface.
	 * Will be called when a dependency changes.
	 */
	update() {
		/* istanbul ignore else */
		if (this.lazy) {
			this.dirty = true
		} else if (this.sync) {
			this.run()
		} else {
			// 渲染watcher会将lazy和sync置为false 执行queueWatcher
			queueWatcher(this)
		}
	}

	/**
	 * Scheduler job interface.
	 * Will be called by the scheduler.
	 */
	run() {
		// 确认watcher是否是存活的
		if (this.active) {
			// 再次调用get方法
			const value = this.get()
			// 渲染watcher的updateComponent实际上是没有返回值的
			if (
				value !== this.value ||
				// Deep watchers and watchers on Object/Arrays should fire even
				// when the value is the same, because the value may
				// have mutated.
				isObject(value) ||
				this.deep
			) {
				// set new value
				const oldValue = this.value
				this.value = value
				// 触发callback函数 如果是用户传入的callback 则会进行捕获异常
				if (this.user) {
					const info = `callback for watcher "${this.expression}"`
					invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
				} else {
					this.cb.call(this.vm, value, oldValue)
				}
			}
		}
	}

	/**
	 * Evaluate the value of the watcher.
	 * This only gets called for lazy watchers.
	 */
	evaluate() {
		this.value = this.get()
		this.dirty = false
	}

	/**
	 * Depend on all deps collected by this watcher.
	 */
	depend() {
		let i = this.deps.length
		while (i--) {
			this.deps[i].depend()
		}
	}

	/**
	 * Remove self from all dependencies' subscriber list.
	 */
	teardown() {
		if (this.active) {
			// remove self from vm's watcher list
			// this is a somewhat expensive operation so we skip it
			// if the vm is being destroyed.
			if (!this.vm._isBeingDestroyed) {
				remove(this.vm._watchers, this)
			}
			let i = this.deps.length
			while (i--) {
				this.deps[i].removeSub(this)
			}
			this.active = false
		}
	}
}
