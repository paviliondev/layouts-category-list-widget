import { createWidget } from 'discourse/widgets/widget';
import { iconNode } from "discourse-common/lib/icon-library";
import { h } from 'virtual-dom';
import DiscourseURL from 'discourse/lib/url';
import Topic from "discourse/models/topic";
import { set } from "@ember/object";
import I18n from "I18n";

let layouts;

try {
  layouts = requirejs('discourse/plugins/discourse-layouts/discourse/lib/layouts');
} catch(error) {
  layouts = { createLayoutsWidget: createWidget };
  console.error(error);
}

const isOlderThanXMonths = (category, count) => {
  return moment(category.latest_post_created_at).isBefore(moment().subtract(count, 'months'));
};

export default layouts.createLayoutsWidget('category-list', {
  
  defaultState(attrs) {
    const topicTracking = this.register.lookup("topic-tracking-state:main");
    const messageBus = this.register.lookup("message-bus:main");
    
    return {
      hideExtraChildren: true,
      topicTracking,
      messageBus
    }
  },
  
  didRenderWidget() {
    this.state.messageBus.subscribe("/new", (data) => {
      if (data.message_type == "new_topic") {
        if (this.attrs.categoryIds.includes(data.payload.category_id)) {
          this.scheduleRerender();
        }
      }
    });
  },
  
  isCurrent(refCat) {
    const { category } = this.attrs;
    return category && (category.id == refCat.id);
  },
  
  isParentOfCurrent(refCat) {
    const { category } = this.attrs;
    return category &&
      category.parentCategory &&
      (category.parentCategory.id == refCat.id);
  },
  
  isGrandparentOfCurrent(refCat) {
    const { category } = this.attrs;
    return category &&
      category.parentCategory &&
      category.parentCategory.parentCategory &&
      (category.parentCategory.parentCategory.id == refCat.id);
  },
  
  getChildren(category) {
    const { childCategories } = this.attrs;
    if (!childCategories || !category || !childCategories[category.slug]) return [];
    return this.filterExclusions(childCategories[category.slug]);
  },
  
  getParents() {
    const { parentCategories } = this.attrs;
    if (!parentCategories) return [];
    return this.filterExclusions(parentCategories);
  },
  
  filterExclusions(list) {
    const excluded = settings.excluded_categories.split('|');
    return list.filter(c => excluded.indexOf(c.slug) === -1);
  },
  
  html(attrs, state) {
    const { category } = attrs;
    const categories = this.getParents();
    
    if (!categories) return '';
    
    let list = [];
    categories.forEach(category => {
      this.addCategory(list, category);
    });
    
    return h('ul.parent-categories', list);
  },
  
  addCategory(list, category, child=false) {
    const { topicTracking, side } = this.state;
    const children = this.getChildren(category);
    const active = this.isCurrent(category);
    
    list.push(
      this.attach('layouts-category-link', {
        category,
        active,
        side,
        toggleOnClick: children.length == 0,
        topicTracking
      })
    );
          
    return this.addChildren(list, category, children, !!child);
  },
  
  addChildren(list, category, children, grandchildren=false) {
    const showChildren = this.isCurrent(category) ||
      this.isParentOfCurrent(category) ||
      this.isGrandparentOfCurrent(category);
          
    if (showChildren && children.length > 0) {
      list.push(
        h(`ul.child-categories${grandchildren ? '.grandchildren' : ''}`,
          this.buildChildList(children)
        )
      );
    }
    
    return list;
  },
  
  buildChildList(list) {
    const { hideExtraChildren } = this.state;
      
    if (settings.order_by_activity.split('|').indexOf(parent.slug) > -1) {
      list = this.orderByActivity(list);
    }
    
    let result = [];
    
    list.some((category, index) => {
      if (category.seperator) {
        if (hideExtraChildren && category.seperator == 1 && index < (list.length - 1)) {
          result.push(h('li', this.attach('button', {
            action: 'showExtraChildren',
            label: 'show_more',
            className: 'btn-small show-extra-children'
          })));
          return true;
        } else {
          result.push(h("li.time-gap", [
            h('span'),
            h('label', I18n.t("dates.medium_with_ago.x_months", { count: Number(category.seperator) })),
            h('span')
          ]));
          return false;
        }
      } else {
        this.addCategory(result, category, true);
        return false;
      }
    });
    
    return result;
  },
  
  showExtraChildren() {
    this.state.hideExtraChildren = false;
    this.scheduleRerender();
  },
  
  orderByActivity(list) {
    list = list.filter(c => c.latest_post_created_at)
      .sort((a,b) => (new Date(b.latest_post_created_at) - new Date(a.latest_post_created_at)))
    
    if (this.currentUser) {
      let monthSeperators = {1:false,2:false,4:false,6:false};
      list.forEach((category, index) => {
        let addSeperator = null;
        Object.keys(monthSeperators).forEach((seperator) => {
          if (!monthSeperators[seperator] && isOlderThanXMonths(category, seperator)) {
            monthSeperators[seperator] = true;
            addSeperator = seperator;
          }
        });
        if (addSeperator) {
          list.splice(index, 0, { seperator: addSeperator });
        }
      });
    }
    return list;
  }
});

createWidget('layouts-category-link', {
  tagName: 'li',
  buildKey: (attrs) => `layouts-category-link-${attrs.category.id}`,
  
  defaultState(attrs) {
    const setCats = settings.show_new.split('|');
    const category = attrs.category;
    const refCats = [category.slug];
    
    if (category.parentCategory) {
      refCats.push(category.parentCategory.slug);
    }
    
    return {
      extraClasses: [],
      showNew: setCats.filter(c => refCats.indexOf(c) > -1).length
    }
  },
  
  buildAttributes() {
    const { category } = this.attrs;
    return {
      "aria-label": category.name,
      title: category.name
    };
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
    return classes;
  },
  
  html(attrs, state) {
    const { category, topicTracking } = attrs;
    let contents = [];
    
    if (category.uploaded_logo) {   
      contents.push(
        h('div.category-logo',
          h('img', {
            attributes: { src: category.uploaded_logo.url }
          })
        )
      )
      if (state.extraClasses.indexOf('has-logo') === -1) {
        state.extraClasses.push('has-logo');
        this.scheduleRerender();
      }
    } 
    
    if (category.read_restricted) {
      contents.push(iconNode("lock"));
    }
    
    contents.push(
      h('div.category-name', category.name)
    );
    
    const newTopics = topicTracking.lookupCount("new", category);
    if (state.showNew && newTopics > 0) {      
      contents.push(
        h('div.badge-notification.new-posts', `${newTopics}`)
      );
      
      if (!category.parentCategory) {
        contents.push(
          this.attach('button', {
            icon: 'check',
            action: 'resetNew',
            actionParam: category,
            className: 'reset-new'
          })
        );
      }
    }
    
    if (attrs.active) {
      contents.push(h('span.active-marker', { 
        attributes: { style: `background-color: #${category.color}` }
      }))
    }
    
    return contents;
  },
  
  click() {
    if (this.attrs.toggleOnClick) {
      this.appEvents.trigger('sidebar:toggle', {
        side: this.attrs.side,
        value: false,
        target: 'responsive'
      });
    }
    DiscourseURL.routeTo(this.attrs.category.url);
    return true;
  },
  
  resetNew(category) {
    Topic.resetNew(category, true).then(() =>
      this.scheduleRerender()
    );
  }
})
