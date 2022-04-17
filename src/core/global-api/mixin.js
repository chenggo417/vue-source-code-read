/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
  	// 将 mixin对象内部的属性拷贝到Vue.options中(@TODO 之后再看mergeOptions)
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
