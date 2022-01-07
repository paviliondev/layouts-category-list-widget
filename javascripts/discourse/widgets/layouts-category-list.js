import { iconNode } from 'discourse-common/lib/icon-library';
import DiscourseURL from 'discourse/lib/url';
import { createWidget } from 'discourse/widgets/widget';
import I18n from 'I18n';
import { h } from 'virtual-dom';

let layouts;

try {
  layouts = requirejs(
    'discourse/plugins/discourse-layouts/discourse/lib/layouts'
  );
} catch (error) {
  layouts = { createLayoutsWidget: createWidget };
  console.warn(error);
}

const isOlderThanXMonths = (category, count) => {
  return moment(category.bumped_at).isBefore(
    moment().subtract(count, 'months')
  );
};

export default layouts.createLayoutsWidget('category-list', {
  defaultState(attrs) {
    const topicTracking = this.register.lookup('topic-tracking-state:main');

    return {
      hideExtraChildren: true,
      topicTracking,
      hideChildren: {},
    };
  },

  didRenderWidget() {
    const self = this;
    this.state.topicTracking.addObserver('states', function () {
      self.scheduleRerender();
    });
  },

  isCurrent(refCat) {
    const { category } = this.attrs;
    return category && category.id == refCat.id;
  },

  isParentOfCurrent(refCat) {
    const { category } = this.attrs;
    return (
      category &&
      category.parentCategory &&
      category.parentCategory.id == refCat.id
    );
  },

  isGrandparentOfCurrent(refCat) {
    const { category } = this.attrs;
    return (
      category &&
      category.parentCategory &&
      category.parentCategory.parentCategory &&
      category.parentCategory.parentCategory.id == refCat.id
    );
  },

  getChildren(category) {
    const { childCategories } = this.attrs;
    if (!childCategories || !category || !childCategories[category.slug])
      return [];

    return this.filterExclusions(childCategories[category.slug]);
  },

  getParents() {
    const { parentCategories } = this.attrs;
    if (!parentCategories) return [];
    return this.filterExclusions(parentCategories);
  },

  filterExclusions(list) {
    const excluded = settings.excluded_categories.split('|');
    return list.filter((c) => excluded.indexOf(c.slug) === -1);
  },

  html(attrs, state) {
    const { category, mobileView, tabletView } = attrs;
    const categories = this.getParents();

    if (!categories) return '';

    let list = [];

    const categoryHeader = this.categoryHeader();
    if (categoryHeader) {
      list.push(this.buildHeader(categoryHeader));
    }

    categories.forEach((category) => {
      this.addCategory(list, category);
    });

    this.addCustomLinks(list);

    if (!mobileView && settings.collapsible_sidebar) {
      let top =
        tabletView || settings.collapsible_sidebar_desktop_toggle === 'top';
      attrs.position = top ? 'top' : 'bottom';
      let minimizeButton = this.attach('layouts-minimize-categories', attrs);

      if (top) {
        list.unshift(minimizeButton);
      } else {
        list.push(minimizeButton);
      }
    }

    return h('ul.parent-categories', list);
  },

  addCustomLinks(list) {
    if (settings.custom_links) {
      const customLinks = [];
      settings.custom_links.split('|').map((link) => {
        let linkItems = link.split(',');
        let linkItem = {
          title: linkItems[0],
          icon: linkItems[1],
          url: linkItems[2],
        };

        let options = {};
        if (linkItems[3]) {
          options = linkItems[3].split(';').reduce((result, opt) => {
            let parts = opt.split(':');
            if (parts.length > 1) {
              result[parts[0]] = parts[1];
            }
            return result;
          }, {});
        }
        linkItem.options = options;

        return customLinks.push(linkItem);
      });

      const linkHeaderBelow = this.linkHeader('below');
      if (linkHeaderBelow) {
        list.push(this.buildHeader(linkHeaderBelow));
      }

      customLinks.forEach((link) => {
        let linkWidget = this.attach('layouts-custom-link', { link });

        if (link.options.location === 'below') {
          list.push(linkWidget);
        } else {
          list.unshift(linkWidget);
        }
      });

      const linkHeaderAbove = this.linkHeader('above');
      if (linkHeaderAbove) {
        list.unshift(this.buildHeader(linkHeaderAbove));
      }
    }
  },

  addCategory(list, category, child = false) {
    const { topicTracking, side, hideChildren } = this.state;
    const { sidebarMinimized } = this.attrs;
    const children = this.getChildren(category);
    const active = this.isCurrent(category);
    const current =
      this.isCurrent(category) ||
      this.isParentOfCurrent(category) ||
      this.isGrandparentOfCurrent(category);
    const hasChildren = children.length > 0;
    const childrenDefaultExpanded =
      settings.child_categories_default_state === 'expanded';
    const shouldExpandChildren = current || childrenDefaultExpanded;
    const showChildren =
      shouldExpandChildren && hasChildren && !hideChildren[category.id];
    const customLogos = this.customLogos();
    const customLogoUrl = customLogos[category.slug];

    list.push(
      this.attach('layouts-category-link', {
        category,
        active,
        side,
        topicTracking,
        current,
        hasChildren,
        showChildren,
        sidebarMinimized,
        customLogoUrl,
      })
    );

    if (showChildren) {
      list.push(
        h(
          `ul.child-categories${!!child ? '.grandchildren' : ''}`,
          this.buildChildList(children, category)
        )
      );
    }

    return list;
  },

  buildChildList(list, category) {
    const { hideExtraChildren } = this.state;

    if (settings.order_by_activity.split('|').indexOf(category.slug) > -1) {
      list = this.orderByActivity(list);
    }

    let result = [];

    list.some((c, index) => {
      if (c.seperator) {
        if (hideExtraChildren && c.seperator == 1 && index < list.length - 1) {
          result.push(
            h(
              'li.show-more',
              this.attach('button', {
                action: 'showExtraChildren',
                label: 'more',
                className: 'btn-small show-extra-children',
              })
            )
          );
          return true;
        } else {
          result.push(
            h('li.time-gap', [
              h('span'),
              h(
                'label',
                I18n.t('dates.tiny.x_months', {
                  count: Number(c.seperator),
                })
              ),
              h('span'),
            ])
          );
          return false;
        }
      } else {
        this.addCategory(result, c, true);
        return false;
      }
    });

    return result;
  },

  showExtraChildren() {
    this.state.hideExtraChildren = false;
    this.scheduleRerender();
  },

  toggleChildren(args) {
    const category = args.category;
    let hideChildren = false;

    if ([true, false].includes(args.hideChildren)) {
      hideChildren = args.hideChildren;
    }

    if (!hideChildren) {
      DiscourseURL.routeTo(category.url);
    }

    this.state.hideChildren[category.id] = hideChildren;
    this.scheduleRerender();
  },

  orderByActivity(list) {
    list = list
      .filter((c) => c.bumped_at)
      .sort((a, b) => new Date(b.bumped_at) - new Date(a.bumped_at));

    let monthSeperators = { 1: false, 2: false, 4: false, 6: false };
    list.forEach((category, index) => {
      let addSeperator = null;
      Object.keys(monthSeperators).forEach((seperator) => {
        if (
          !monthSeperators[seperator] &&
          isOlderThanXMonths(category, seperator)
        ) {
          monthSeperators[seperator] = true;
          addSeperator = seperator;
        }
      });
      if (addSeperator) {
        list.splice(index, 0, { seperator: addSeperator });
      }
    });

    return list;
  },

  customLogos() {
    return settings.custom_logos.split('|').reduce((result, item) => {
      let parts = item.split(/:(.+)/);
      if (parts.length > 1) {
        result[parts[0]] = parts[1];
      }
      return result;
    }, {});
  },

  customHeaders() {
    return settings.custom_headers.split('|').map((setting) => {
      let parts = setting.split(',');
      let options = parts[1] ? parts[1].split(':') : [];
      return {
        label: parts[0],
        type: options[0],
        position: options[1],
        link: parts[2],
      };
    });
  },

  categoryHeader() {
    const headers = this.customHeaders();
    const categoryHeaders = headers.filter((h) => h.type === 'categories');
    return categoryHeaders.length ? categoryHeaders[0] : null;
  },

  linkHeader(position) {
    const headers = this.customHeaders();
    const linkHeaders = headers.filter(
      (h) => h.type === 'links' && h.position === position
    );
    return linkHeaders.length ? linkHeaders[0] : null;
  },

  buildHeader(header) {
    const { sidebarMinimized } = this.attrs;
    let headerContent = sidebarMinimized ? '' : header.label;
    let contents = h(
      'h3',
      { attributes: { title: header.label } },
      headerContent
    );

    if (header.link) {
      contents = h('a', { attributes: { href: header.link } }, contents);
    }

    let extraClasses = '';
    if (!header.link) {
      extraClasses += '.no-link';
    }

    return h(`li.layouts-category-link.header${extraClasses}`, contents);
  },
});

createWidget('layouts-minimize-categories', {
  tagName: 'li.layouts-minimize-button.layouts-category-link',

  buildClasses(attrs) {
    const { tabletView, position } = attrs;
    let classes = `${position}`;

    if (tabletView) {
      classes += ' menu';
    }

    return classes;
  },

  html(attrs, state) {
    const { tabletView, sidebarMinimized } = attrs;
    let result = [];

    let iconClasses = sidebarMinimized ? 'minimized' : '';
    let iconKey = tabletView
      ? sidebarMinimized
        ? 'bars'
        : 'times'
      : 'chevron-circle-left';
    let icon = h(
      `div.category-logo.minimize-icon.${iconClasses}`,
      iconNode(iconKey)
    );
    let textKey = tabletView ? 'menu_button_label' : 'minimize_button_label';
    let text = h(
      'div.category-name.minimize-text',
      I18n.t(themePrefix(textKey))
    );

    if (tabletView) {
      result.push(text);
    }

    result.push(icon);

    if (!tabletView) {
      result.push(text);
    }

    return result;
  },

  click(attrs) {
    this.scheduleRerender();
    this.notifyMinimizedStateChange();
  },

  notifyMinimizedStateChange() {
    let type;

    this.appEvents.trigger('sidebar:toggle', {
      side: this.attrs.side,
      value: !this.attrs.sidebarMinimized,
      target: 'desktop',
      type: 'minimize',
    });
  },
});

createWidget('layouts-category-link', {
  tagName: 'li',
  buildKey: (attrs) => `layouts-category-link-${attrs.category.id}`,

  defaultState(attrs) {
    const setCats = settings.show_latest.split('|');
    const category = attrs.category;
    const refCats = [category.slug];

    if (category.parentCategory) {
      refCats.push(category.parentCategory.slug);
    }

    return {
      extraClasses: [],
      showLatest: setCats.filter((c) => refCats.indexOf(c) > -1).length,
    };
  },

  buildAttributes() {
    const { category, sidebarMinimized } = this.attrs;

    const attributes = {};

    if (sidebarMinimized) {
      attributes['data-tooltip'] = category.name;
    }

    attributes['aria-label'] = category.name;
    attributes['title'] = category.name;

    return attributes;
  },

  buildClasses(attrs, state) {
    let classes = 'layouts-category-link';
    if (attrs.active) {
      classes += ' active';
    }
    if (!attrs.category.parentCategory) {
      classes += ' parent-category';
    }
    if (state.extraClasses.length) {
      classes += ` ${state.extraClasses.join(' ')}`;
    }
    if (attrs.showChildren) {
      classes += ' showing-children';
    }
    return classes;
  },

  html(attrs, state) {
    const {
      category,
      topicTracking,
      hasChildren,
      showChildren,
      sidebarMinimized,
      current,
      customLogoUrl,
    } = attrs;
    let contents = [];
    let logoContents;
    let logoUrl;
    let lockIcon = settings.category_lock_icon || 'lock';

    if (customLogoUrl) {
      logoUrl = customLogoUrl;
    } else if (category.uploaded_logo && !settings.disable_category_logos) {
      logoUrl = category.uploaded_logo.url;
    }

    if (logoUrl) {
      logoContents = h('img', {
        attributes: {
          src: logoUrl,
        },
      });

      if (state.extraClasses.indexOf('has-logo') === -1) {
        state.extraClasses.push('has-logo');
        this.scheduleRerender();
      }
    } else if (settings.auto_generate_category_logos) {
      logoContents = h(
        'span.category-text-logo',
        {
          attributes: {
            style: `border: 1px solid #${category.color}`,
          },
        },
        category.name.substring(0, 2)
      );
    } else if (settings.category_badges) {
      logoContents = h(
        `span.badge-wrapper.${category.siteSettings.category_style}`,
        h('span.badge-category-bg', {
          attributes: {
            style: `background-color: #${category.color}`,
          },
        })
      );
    }

    contents.push(
      h(
        `div.category-logo.${category.slug}`,
        {
          attributes: {
            'data-category-id': category.id,
          },
        },
        logoContents
      )
    );

    if (category.read_restricted) {
      contents.push(iconNode(lockIcon, { class: 'category-lock-icon' }));
    }

    contents.push(h('div.category-name', category.name));

    const latestTopicCount = topicTracking.lookupCount('latest', category);
    if (state.showLatest && latestTopicCount > 0) {
      contents.push(
        h('div.badge-notification.new-posts', `${latestTopicCount}`)
      );
    }

    if (hasChildren && !sidebarMinimized) {
      let actionParam = { category };

      if (current) {
        actionParam.hideChildren = showChildren;
      }

      contents.push(
        this.attach('button', {
          icon: showChildren ? 'chevron-up' : 'chevron-down',
          action: 'toggleChildren',
          actionParam,
          className: 'toggle-children',
        })
      );
    }

    if (attrs.active) {
      contents.push(
        h('span.active-marker', {
          attributes: { style: `background-color: #${category.color}` },
        })
      );
    }

    return contents;
  },

  click() {
    if (!this.attrs.hasChildren) {
      this.appEvents.trigger('sidebar:toggle', {
        side: this.attrs.side,
        value: false,
        target: 'mobile',
      });
    }
    this.sendWidgetAction('toggleChildren', {
      category: this.attrs.category,
      hideChildren: false,
    });
    return true;
  },
});

createWidget('layouts-custom-link', {
  tagName: 'li',

  buildClasses(attrs) {
    const { link } = attrs;
    let classes = 'layouts-custom-link layouts-category-link';

    let data = Object.assign(
      {},
      document.getElementById('data-discourse-setup').dataset
    );
    let baseUrl = data && data.baseUrl ? data.baseUrl : '';
    let url = baseUrl + link.url;
    let currentUrl = window.location.href;
    if (url === currentUrl) {
      classes += ' active';
    }

    return classes;
  },

  html(attrs, state) {
    const { link } = attrs;
    let result = [];

    let title = h(
      'div.category-name',
      {
        attributes: {
          title: link.title,
        },
      },
      link.title
    );

    let icon = h(
      'div.category-logo',
      h('img', {
        attributes: {
          src: link.icon,
          alt: link.title,
        },
      })
    );

    result.push(icon, title);
    return result;
  },

  click() {
    const { link } = this.attrs;
    const url = link.url;

    if (link.options.new_tab === 'true') {
      window.open(url, '_blank');
    } else {
      DiscourseURL.routeTo(url);
    }
  },
});
