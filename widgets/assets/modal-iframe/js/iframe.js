/*-------------------------------

 IFRAME.JS

 Iframe manager plugin for Yii2 Grom Platform

 @author Roman Gayazov
 @version 1.0.0

 -------------------------------*/
yii.gromverIframe = (function ($) {
    var iframeCount = 0,
        relations = [],
        defaultIframeOptions = {
            width: '100%',
            height: '400px',
            frameborder: '0'
        },
        pub = {
            namePrefix: 'gromver-iframe-',
            isActive: true,
            dataHandler: null,
            init: function() {
                initDataMethods();
                initEvents();
            },
            createIframeName: function() {
                return this.namePrefix + (++iframeCount);
            },
            postData: function(data) {
                postMessage('send', data);
            },
            refreshParent: function() {
                postMessage('refresh');
            },
            // закрывает активное модальное окно
            closePopup: function() {
                postMessage('close');
            },
            handleAction: function ($e) {
                /*
                 - action
                 - iframeOptions
                 - formOptions
                 */
                var formOptions = $e.data('form'),
                    iframeOptions = $e.data('iframe'),
                    action = $e.attr('href'),
                    handler = $e.data('handler');

                if (handler) {
                    eval("this.dataHandler = " + handler);
                } else {
                    this.dataHandler = null;
                }

                if (iframeOptions && $.isPlainObject(iframeOptions)) {
                    if ($.type(iframeOptions.src) === 'string') {
                        action = iframeOptions.src;
                    }
                }

                if (formOptions && $.isPlainObject(formOptions)) {
                    formOptions.method = formOptions.method || 'get';

                    if ($.type(formOptions.action) === 'string') {
                        action = formOptions.action;
                    }

                    if (!action || !action.match(/(^\/|:\/\/)/)) {
                        action = window.location.href;
                    }
                }

                postMessage('open', {
                    action: action,
                    formOptions: formOptions,
                    iframeOptions: iframeOptions
                });
            }
        };

    function postMessage(name, message, target) {
        var data = {
            name: name + '.iframe.gromver',
            message: message
        };

        (target || window.parent).postMessage(JSON.stringify(data), window.location.origin);
    }

    function initDataMethods() {
        var handler = function (event) {
            pub.handleAction($(this));
            event.stopImmediatePropagation();
            return false;
        };

        // handle data-confirm and data-method for clickable and changeable elements
        $(document).on('click.yii', '[data-behavior="iframe"]', handler);
    }

    function initEvents() {
        attachPostMessageHandler(function(e) {
            var data = JSON.parse(e.data);
            if(data.name) {
                $(pub).triggerHandler(data.name, [data.message, e.source]);
            }
        });

        $(pub).on('open.iframe.gromver', function(e, data, source) {
            var action = data.action,
                formOptions = data.formOptions,
                iframeOptions = $.extend(true, {}, defaultIframeOptions, data.iframeOptions);

            if (formOptions) {
                var method = formOptions.method,
                    params = formOptions.params,
                    target = this.createIframeName(),
                    $iframe = $('<iframe id="' + target + '" name="' + target + '"></iframe>'),
                    $form = $('<form target="' + target + '" method="' + method + '"></form>'),
                    popupOptions = {
                        content: $iframe,
                        afterClose: popRelation
                    };

                $form.prop('action', action);

                if (!method.match(/(get|post)/i)) {
                    $form.append('<input name="_method" value="' + method + '" type="hidden">');
                    method = 'POST';
                }
                if (!method.match(/(get|head|options)/i)) {
                    var csrfParam = yii.getCsrfParam();
                    if (csrfParam) {
                        $form.append('<input name="' + csrfParam + '" value="' + yii.getCsrfToken() + '" type="hidden">');
                    }
                }
                $form.hide().appendTo('body');

                // temporarily add hidden inputs according to data-params
                if (params && $.isPlainObject(params)) {
                    $.each(params, function (idx, obj) {
                        $form.append('<input name="' + idx + '" value="' + obj + '" type="hidden">');
                    });
                }

                $iframe.attr(iframeOptions);
                $iframe.load(function(){
                    pushRelation(source, this.contentWindow);
                });

                yii.gromverPopup.open(popupOptions);
                $form.trigger('submit');
                $form.remove();
            } else {
                if (window.location.pathname == action) {
                    //баг с отображением тойже страницы что отображена в родительском окне, добавим мусор в урл)
                    action += "?" + Math.floor(Math.random() * 10000);
                }

                $iframe = $('<iframe src="' + action + '"></iframe>');

                popupOptions = {
                    content: $iframe,
                    afterClose: popRelation
                };

                $iframe.attr(iframeOptions);
                $iframe.load(function(){
                    pushRelation(source, this.contentWindow);
                });

                yii.gromverPopup.open(popupOptions);
            }
        });
        // событие отправки данных (попадает в окно топ уровня, и оттуда пересылается нужному окну событием receive)
        $(pub).on('send.iframe.gromver', function(e, data, source) {
            postMessage('receive', data, parentRelation(source));
        });
        // событие для получателя данных
        $(pub).on('receive.iframe.gromver', function(e, data, source) {
            if ($.isFunction(this.dataHandler)) {
                this.dataHandler(data);
            }
        });
        // событие перезагрузки страницы
        $(pub).on('refresh.iframe.gromver', function(e, data, source) {
            parentRelation(source).location.reload(true)
        });
        // событие закрытия модального окна
        $(pub).on('close.iframe.gromver', function(e, data, source) {
            yii.gromverPopup.close();
        });
    }

    function attachPostMessageHandler(handler) {
        if (window.addEventListener) {
            window.addEventListener("message", handler, false);
        } else {
            window.attachEvent("onmessage", handler);
        }
    }

    function pushRelation(parent, child) {
        relations.push({
            parent: parent,
            child: child
        });
    }

    function popRelation() {
        relations.pop();
    }

    function parentRelation(child) {
        var parent;

        $.each(relations, function(i, rel) {
            if (rel.child === child) {
                parent = rel.parent;
                return false;
            }
        });

        return parent;
    }

    return pub;
})(jQuery);