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
  
  html(attrs, state) {
    const { category, parentCategories, childCategories, side } = attrs;
    const { topicTracking, hideExtraChildren } = state;
    const excluded = settings.excluded_categories.split('|');
    
    if (!parentCategories) return '';
    
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
          side,
          toggle: !children,
          topicTracking
        })
      );
            
      if ((isCurrent(parent) || isParent) && children) {
        let childrenList = children.filter(c => excluded.indexOf(c.slug) === -1);
        let orderedChildrenList = childrenList;
        let orderByActivity = settings.order_by_activity.split('|').indexOf(parent.slug) > -1;
        
        if (orderByActivity) {
          orderedChildrenList = childrenList.filter(c => c.latest_post_created_at)
            .sort((a,b) => (new Date(b.latest_post_created_at) - new Date(a.latest_post_created_at)))
          
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
        
        let childCategoryList = [];
        
        orderedChildrenList.some((child, index) => {
          if (child.seperator) {
            if (hideExtraChildren &&
                child.seperator == 1 && 
                index < (orderedChildrenList.length - 1)) {
              
              childCategoryList.push(
                h('li',
                  this.attach('button', {
                    action: 'showExtraChildren',
                    label: 'show_more',
                    className: 'btn-small show-extra-children'
                  })
                )
              );
              return true;
            } else {
              childCategoryList.push(
                h("li.time-gap", [
                  h('span'),
                  h('label', I18n.t("dates.medium_with_ago.x_months", {
                    count: Number(child.seperator)
                  })),
                  h('span')
                ])
              );
              return false;
            }
          } else {
            childCategoryList.push(
              this.attach('layouts-category-link', {
                category: child,
                active: isCurrent(child),
                side,
                toggle: true,
                topicTracking
              })
            );
            return false;
          }
        });
        
        contents.push(h('ul.child-categories', childCategoryList));
      }
      
      return contents;
    });
    
    return h('ul.parent-categories', categoryList);
  },
  
  showExtraChildren() {
    this.state.hideExtraChildren = false;
    this.scheduleRerender();
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
    if (this.attrs.toggle) {
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
