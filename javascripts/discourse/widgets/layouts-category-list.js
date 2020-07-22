import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';
import DiscourseURL from 'discourse/lib/url';
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
  html(attrs, state) {
    const { category, parentCategories, childCategories, side } = attrs;
    const excluded = settings.excluded_categories.split('|');
    
    let categoryList = parentCategories.filter(c => {
      return excluded.indexOf(c.slug) === -1;
    }).map(parent => {
      let contents = [];
      let isCurrent = (cat) => (category && (category.id == cat.id));
      let isParent = category && category.parentCategory && category.parentCategory.id == parent.id;
      let children = childCategories[parent.slug];
            
      contents.push(
        this.attach('layouts-category-link', {
          category: parent,
          active: isCurrent(parent),
          side
        })
      );
            
      if ((isCurrent(parent) || isParent) && children) {
        let childrenList = children.filter(c => excluded.indexOf(c.slug) === -1);
        let orderedChildrenList = childrenList;
        let orderByActivity = settings.order_by_activity.split('|').indexOf(parent.slug) > -1;
        
        if (orderByActivity) {
          orderedChildrenList = _.sortBy(childrenList, 'latest_post_created_at').reverse();
          
          if (this.currentUser) {
            let monthSeperators = {1:false,2:false,4:false,6:false};
            orderedChildrenList.forEach((category, index) => {
              let addSeperator = null;
              Object.keys(monthSeperators).forEach((seperator) => {
                if (!monthSeperators[seperator] && isOlderThanXMonths(category, seperator)) {
                  monthSeperators[seperator] = true;
                  addSeperator = seperator;
                }
              });
              if (addSeperator) {
                orderedChildrenList.splice(index, 0, { seperator: addSeperator });
              }
            });
          }
        }
        
        contents.push(
          h('ul.child-categories',
            orderedChildrenList.map(child => {
              if (child.seperator) {
                return h("li.time-gap", [
                  h('span'),
                  h('label', I18n.t("dates.medium_with_ago.x_months", {
                    count: Number(child.seperator)
                  })),
                  h('span')
                ]);
              } else {
                return this.attach('layouts-category-link', {
                  category: child,
                  active: isCurrent(child),
                  side
                });
              }
            })
          )
        )
      }
      
      return contents;
    });
    
    return h('ul.parent-categories', categoryList);
  }
});

createWidget('layouts-category-link', {
  tagName: 'li',
  buildKey: (attrs) => `layouts-category-link-${attrs.category.id}`,
  
  defaultState(attrs) {
    const setCats = settings.show_unread.split('|');
    const category = attrs.category;
    const refCats = [category.slug];
    
    if (category.parentCategory) {
      refCats.push(category.parentCategory.slug);
    }
    
    return {
      extraClasses: [],
      showUnread: setCats.filter(c => refCats.indexOf(c) > -1).length
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
    if (state.extraClasses.length) {
      classes += ` ${state.extraClasses.join(' ')}`;
    }
    return classes;
  },
  
  html(attrs, state) {
    const { category } = attrs;
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
    
    contents.push(h('div.category-name', category.name))

    if (state.showUnread && category.unreadTopics > 0) {
      contents.push(h('div.badge-notification.unread-posts', `${category.unreadTopics}`));
    }
    
    if (attrs.active) {
      contents.push(h('span.active-marker', { 
        attributes: { style: `background-color: #${category.color}` }
      }))
    }
    
    return contents;
  },
  
  click() {
    this.appEvents.trigger('sidebar:toggle', this.attrs.side);
    DiscourseURL.routeTo(this.attrs.category.url);
    return true;
  }
})
