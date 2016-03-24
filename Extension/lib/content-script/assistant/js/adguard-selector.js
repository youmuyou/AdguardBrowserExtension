/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Adguard selector library
 */
var AdguardSelectorLib = (function (api, $) {

    // PRIVATE FIELDS

    var BORDER_WIDTH = 5;
    var BORDER_PADDING = 2;
    var BORDER_CLASS = "sg_border";

    var borderTop = null;
    var borderLeft = null;
    var borderRight = null;
    var borderBottom = null;

    var PLACEHOLDER_PREFIX = 'adguard-placeholder';
    var placeholdedElements = null;

    var restrictedElements = null;
    var predictionHelper = null;

    var SUGGESTED_CLASS = "sg_suggested";
    var SELECTED_CLASS = "sg_selected";
    var REJECTED_CLASS = "sg_rejected";
    var IGNORED_CLASS = "sg_ignore";

    var selectedElements = [];
    var rejectedElements = [];

    var selectMode = 'exact';
    var unbound = true;
    var onElementSelectedHandler = null;

    /********** iOS modifications ***************/

    var isIOS = (navigator.platform === 'iPad' || navigator.platform === 'iPhone');

    /**
    We need use touch event model, because exists HITROZHOPYE web designers
    */
    var ignoreTouchEvent = 0;
    /*******************************************/


    // PRIVATE METHODS

    var removeClassName = function (className) {
        $('.' + className).removeClass(className);
    };

    var suggestPredicted = function (prediction) {
        if (prediction) {
            $(prediction).each(function () {
                if (!$(this).hasClass(SELECTED_CLASS)
                    && !$(this).hasClass(IGNORED_CLASS)
                    && !$(this).hasClass(REJECTED_CLASS)) {
                    $(this).addClass(SUGGESTED_CLASS);
                }
            });
        }
    };

    var makePredictionPath = function (elem) {
        var w_elem = $(elem);

        if (w_elem.hasClass(SELECTED_CLASS)) {
            w_elem.removeClass(SELECTED_CLASS);
            selectedElements.splice($.inArray(elem, selectedElements), 1);
        } else if (w_elem.hasClass(REJECTED_CLASS)) {
            w_elem.removeClass(REJECTED_CLASS);
            rejectedElements.splice($.inArray(elem, rejectedElements), 1);
        } else if (w_elem.hasClass(SUGGESTED_CLASS)) {
            w_elem.addClass(REJECTED_CLASS);
            rejectedElements.push(elem);
        } else {
            if (selectMode == 'exact' && selectedElements.length > 0) {
                removeClassName(SELECTED_CLASS);
                selectedElements = [];
            }
            //w_elem.addClass('sg_selected');
            selectedElements.push(elem);
        }

        var prediction = predictionHelper.predictCss(selectedElements,
            rejectedElements.concat(restrictedElements));

        if (selectMode == 'similar') {
            removeClassName(SUGGESTED_CLASS);
            suggestPredicted(prediction);
        }

        return prediction;
    };

    var firstSelectedOrSuggestedParent = function (element) {
        if ($(element).hasClass(SUGGESTED_CLASS) || $(element).hasClass(SELECTED_CLASS)) {
            return element;
        }

        while (element.parentNode && (element = element.parentNode)) {
            if (restrictedElements.indexOf(element) == -1) {
                if ($(element).hasClass(SUGGESTED_CLASS) || $(element).hasClass(SELECTED_CLASS)) {
                    return element;
                }
            }
        }

        return null;
    };


    var px = function (p) {
        return p + 'px';
    };

    var getTagPath = function (element) {
        if (element.parentNode) {
            return element.parentNode.tagName.toLowerCase() + ' ' + element.tagName.toLowerCase();
        } else {
            return element.tagName.toLowerCase();
        }
    };

    var removeBorderFromDom = function () {
        if (borderTop && borderTop.get(0)) {
            var parent = borderTop.get(0).parentNode;

            if (parent) {
                parent.removeChild(borderTop.get(0));
                parent.removeChild(borderBottom.get(0));
                parent.removeChild(borderLeft.get(0));
                parent.removeChild(borderRight.get(0));
            }
        }

        borderTop = borderBottom = borderRight = borderLeft = null;
    };

    var addBorderToDom = function () {
        document.body.appendChild(borderTop.get(0));
        document.body.appendChild(borderBottom.get(0));
        document.body.appendChild(borderLeft.get(0));
        document.body.appendChild(borderRight.get(0));
    };

    var showBorders = function () {
        if (borderTop && borderBottom && borderLeft && borderRight) {
            borderTop.show();
            borderBottom.show();
            borderLeft.show();
            borderRight.show();
        }
    };

    var clearSelected = function () {
        selectedElements = [];
        rejectedElements = [];

        removeClassName(SELECTED_CLASS);
        removeClassName(REJECTED_CLASS);

        selectionRenderer.remove();
        removeClassName(SUGGESTED_CLASS);
    };

    /**
     * Returns element offset coordinates extended with width and height values.
     *
     * @param elem
     * @returns {{top: number, left: number, outerWidth: number, outerHeight: number}}
     */
    var getOffsetExtended = function (elem) {
        var rect = elem.getBoundingClientRect();

        var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        return {
            top: rect.top + scrollTop,
            left: rect.left + scrollLeft,
            outerWidth: elem.offsetWidth,
            outerHeight: elem.offsetHeight
        };
    };

    /**
     * Adds borders to selected element.
     *
     * Default implementation of selection renderer.
     * Can be overwritten with custom implementation as a parameter of init function.
     *
     * @param element
     * @private
     */
     var selectionRenderer = {

         /**
            Preparing renderer.
         */
         init: function(){

             if (!borderTop) {
                 var width = px(BORDER_WIDTH);

                 borderTop = $('<div/>').addClass(BORDER_CLASS).css('height', width).hide()
                     .on("click", sgMousedownHandler);
                 borderBottom = $('<div/>').addClass(BORDER_CLASS).addClass('sg_bottom_border')
                     .css('height', px(BORDER_WIDTH + 6)).hide()
                     .on("click", sgMousedownHandler);
                 borderLeft = $('<div/>').addClass(BORDER_CLASS).css('width', width).hide()
                     .on("click", sgMousedownHandler);
                 borderRight = $('<div/>').addClass(BORDER_CLASS).css('width', width).hide()
                     .on("click", sgMousedownHandler);

                 addBorderToDom();
             }
         },

         /**
            Clearing DOM and so on.
         */
         finalize: function(){

             removeBorderFromDom();
         },

         add: function (element) {
             this.remove();

             if (!element) {
                 return;
             }

             var p = getOffsetExtended(element);

             var top = p.top;
             var left = p.left;
             var width = p.outerWidth;
             var height = p.outerHeight;

             borderTop.css('width', px(width + BORDER_PADDING * 2 + BORDER_WIDTH * 2)).
             css('top', px(top - BORDER_WIDTH - BORDER_PADDING)).
             css('left', px(left - BORDER_PADDING - BORDER_WIDTH));
             borderBottom.css('width', px(width + BORDER_PADDING * 2 + BORDER_WIDTH * 2 - 5)).
             css('top', px(top + height + BORDER_PADDING)).
             css('left', px(left - BORDER_PADDING - BORDER_WIDTH));
             borderLeft.css('height', px(height + BORDER_PADDING * 2)).
             css('top', px(top - BORDER_PADDING)).
             css('left', px(left - BORDER_PADDING - BORDER_WIDTH));
             borderRight.css('height', px(height + BORDER_PADDING * 2)).
             css('top', px(top - BORDER_PADDING)).
             css('left', px(left + width + BORDER_PADDING));

             borderBottom.get(0).textContent = getTagPath(element);
             borderRight.get(0).target_elem = borderLeft.get(0).target_elem = borderTop.get(0).target_elem = borderBottom.get(0).target_elem = element;

             showBorders();
         },

         remove: function () {
             if (borderTop && borderBottom && borderLeft && borderRight) {
                 borderTop.hide();
                 borderBottom.hide();
                 borderLeft.hide();
                 borderRight.hide();
             }
         }
     };

    var linkHelper = document.createElement('a');
    var getHost = function (url) {
        if (!url) {
            return "";
        }

        linkHelper.href = url;
        return linkHelper.hostname;
    };

    var makePlaceholderImage = function (element) {
        var placeHolder = document.createElement('div');
        var style = window.getComputedStyle(element);
        placeHolder.style.height = style.height;
        placeHolder.style.width = style.width;
        placeHolder.style.position = style.position;
        placeHolder.style.top = style.top;
        placeHolder.style.bottom = style.bottom;
        placeHolder.style.left = style.left;
        placeHolder.style.right = style.right;
        placeHolder.className += PLACEHOLDER_PREFIX;

        var icon = document.createElement('div');
        icon.className += PLACEHOLDER_PREFIX + "-icon " + IGNORED_CLASS;

        var domain = document.createElement('div');
        domain.textContent = getHost(element.src);
        domain.className += PLACEHOLDER_PREFIX + "-domain " + IGNORED_CLASS;

        icon.appendChild(domain);
        placeHolder.appendChild(icon);

        return placeHolder;
    };

    var removePlaceholders = function () {
        if (!placeholdedElements) {
            return;
        }

        var elements = placeholdedElements;
        for (var i = 0; i < elements.length; i++) {
            var current = elements[i];
            var id = PLACEHOLDER_PREFIX + i;

            var placeHolder = $('#' + id).get(0);
            if (placeHolder) {
                var parent = placeHolder.parentNode;
                if (parent) {
                    parent.replaceChild(current, placeHolder);
                }
            }
        }

        placeholdedElements = null;
    };

    var placeholderClick = function (element) {
        selectionRenderer.remove();
        removePlaceholders();

        onElementSelectedHandler(element);
    };

    var makeIFrameAndEmbededSelector = function () {
        placeholdedElements = $('iframe:not(.' + IGNORED_CLASS + '),embed,object').filter(function(elem) {
            return elem.style["display"] != "none";
        });

        var elements = placeholdedElements;
        for (var i = 0; i < elements.length; i++) {
            var current = elements[i];
            (function(current){
                var placeHolder = makePlaceholderImage(current);
                var id = PLACEHOLDER_PREFIX + i;

                placeHolder.id = id;

                var parent = current.parentNode;
                if (parent) {
                    parent.replaceChild(placeHolder, current);
                    if (isIOS) {

                        $(placeHolder).on("gestureend", iosGestureEndHandler);
                        $(placeHolder).on("touchmove", iosTouchMoveHandler);
                        $(placeHolder).on("touchend", function(e) {
                            e.preventDefault();
                            if (needIgnoreTouchEvent()) {
                                return true;
                            }
                            placeholderClick(current);
                        });
                    }
                    else{

                        $(placeHolder).on('click', function (e) {
                            e.preventDefault();

                            placeholderClick(current);
                        });
                    }

                }

            })(current);
        }
    };

    var sgMouseoverHandler = function (e) {
        e.stopPropagation();

        if (unbound) {
            return true;
        }

        if (this == document.body || this == document.body.parentNode) {
            return false;
        }

        var parent = firstSelectedOrSuggestedParent(this);
        if (parent != null && parent != this) {
            selectionRenderer.add(parent);
        } else {
            selectionRenderer.add(this);
        }

        return false;
    };

    var sgMouseoutHandler = function () {
        if (unbound) {
            return true;
        }

        if (this == document.body || this == document.body.parentNode) {
            return false;
        }

        selectionRenderer.remove();
        return false;
    };

    /**
     * Block clicks for a moment by covering this element with a div.
     *
     * @param elem
     * @returns {boolean}
     * @private
     */
    var blockClicksOn = function (elem) {
        var p = getOffsetExtended(elem);
        var block = $('<div/>').css('position', 'absolute').css('z-index', '9999999').css('width', px(p.outerWidth)).
            css('height', px(p.outerHeight)).css('top', px(p.top)).css('left', px(p.left)).
            css('background-color', '');

        var blockElement = block.get(0);
        document.body.appendChild(blockElement);

        setTimeout(function () {
            if (blockElement) {
                blockElement.parentNode.removeChild(blockElement);
            }
        }, 400);

        return false;
    };

    var sgMousedownHandler = function (e) {
        e.preventDefault();

        if (unbound) {
            return true;
        }

        var elem = this;
        if ($(elem).hasClass(BORDER_CLASS)) {
            //Clicked on one of our floating borders, target the element that we are bordering.
            elem = elem.target_elem || elem;
        }

        if (elem == document.body || elem == document.body.parentNode) {
            return;
        }

        // Don't allow selection of elements that have a selected child.
        if ($('.' + SELECTED_CLASS, this).get(0)) {
            blockClicksOn(elem);
        }

        makePredictionPath(elem);

        selectionRenderer.remove();
        blockClicksOn(elem);

        onElementSelectedHandler(elem);

        return false;
    };

    /********** iOS modifications ***************/
    var iosElementSelectHandler = function(e){

        sgMouseoverHandler.call(this,e);
        sgMousedownHandler.call(this,e);
    };

    var needIgnoreTouchEvent = function(){

        if(ignoreTouchEvent > 0){

          ignoreTouchEvent--;
          return true;
        }

        return false;
    }

    var iosElementTouchendHandler = function(e){
       e.stopPropagation();

      if (needIgnoreTouchEvent()) {
          return true;
      }

      iosElementSelectHandler.call(this, e);
      return false;
    };

    var iosPreventEventHandler = function(e){

      e.stopPropagation();
      // e.preventDefault();

      return false;
    };

    var iosGestureEndHandler = function(e){
        ignoreTouchEvent = 2;
        return true;
    };

    var iosTouchMoveHandler = function(e){
        ignoreTouchEvent = 1;
        return true;
    };

    /*******************************************/

    var setupEventHandlers = function () {
        makeIFrameAndEmbededSelector();

        var sgIgnore = $("body *:not(." + IGNORED_CLASS + ")");

        if (isIOS) {

            sgIgnore.on("gestureend", iosGestureEndHandler);
            sgIgnore.on("touchmove", iosTouchMoveHandler);
            sgIgnore.on("touchend", iosElementTouchendHandler);
            sgIgnore.on('touchstart', iosPreventEventHandler);
        }
        else {

            sgIgnore.on("mouseover", sgMouseoverHandler);
            sgIgnore.on("mouseout", sgMouseoutHandler);
            sgIgnore.on("click", sgMousedownHandler);
        }
    };

    var deleteEventHandlers = function () {
        removePlaceholders();

        var elements = $("body *");
        if (isIOS) {
            elements.off("gestureend", iosGestureEndHandler);
            elements.off("touchmove", iosTouchMoveHandler);
            elements.off("touchend", iosElementTouchendHandler);
            elements.off('touchstart', iosPreventEventHandler);
        }
        else{
            elements.off("mouseover", sgMouseoverHandler);
            elements.off("mouseout", sgMouseoutHandler);
            elements.off("click", sgMousedownHandler);
        }
    };

    // PUBLIC API

    /**
     * Starts selector module.
     *
     * @param onElementSelected callback function
     * @param selectionRenderFunc optional function contains selection presentation implementation
     */
    api.init = function (onElementSelected, selectionRenderFunc) {

        onElementSelectedHandler = onElementSelected;
        if (selectionRenderFunc && typeof selectionRenderFunc === "object") {
            selectionRenderer = selectionRenderFunc;
        }

        restrictedElements = ['html', 'body', 'head', 'base'].map(function (selector) {
            return $(selector).get(0);
        });
        predictionHelper = new DomPredictionHelper($, String);

        selectionRenderer.init();
        setupEventHandlers();
        unbound = false;
    };

    /**
     * Resets state of selector.
     * Clears current selection.
     */
    api.reset = function () {
        clearSelected();
    };

    /**
     * Destroys selector module.
     * Removes all selector elements and unbinds event handlers.
     */
    api.close = function () {
        unbound = true;

        selectionRenderer.finalize();
        deleteEventHandlers();
    };

    /**
     * Selects specified element.
     * Marks element as selected and holds selection on it.
     *
     * @param element
     */
    api.selectElement = function (element) {
        selectionRenderer.add(element);

        unbound = true;
        deleteEventHandlers();
    };

    /**
        Returns css class name.
        If this class assigns to HTML element, then Adguard Selector ignores it.
    */
    api.ignoreClassName = function (){

    return IGNORED_CLASS;
    };

    return api;

})(AdguardSelectorLib || {}, balalaika);
