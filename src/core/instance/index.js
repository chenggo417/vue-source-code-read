import {initMixin} from './init'
import {stateMixin} from './state'
import {renderMixin} from './render'
import {eventsMixin} from './events'
import {lifecycleMixin} from './lifecycle'
import {warn} from '../util/index'

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
