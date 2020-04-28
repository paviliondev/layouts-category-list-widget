import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';
import DiscourseURL from 'discourse/lib/url';

let layoutsError;
let layouts;

try {
  layouts = requirejs('discourse/plugins/discourse-layouts/discourse/lib/layouts');
} catch(error) {
  layouts = { createLayoutsWidget: createWidget };
  console.error(error);
}

export default layouts.createLayoutsWidget('category-list', {
  html(attrs, state) {
    const { category, parentCategories, childCategories } = attrs;
    const excluded = settings.excluded_categories.split('|');
        
    return h('ul.parent-categories', parentCategories.filter(c => {
        return excluded.indexOf(c.slug) === -1;
      }).map(parent => {
        let contents = [];
        let isCurrent = (cat) => (category && (category.id == cat.id));
        let isParent = category && category.parentCategory && category.parentCategory.id == parent.id;
        let children = childCategories[parent.slug];
              
        contents.push(
          this.attach('layouts-category-link', {
            category: parent,
            active: isCurrent(parent)
          })
        );
              
        if ((isCurrent(parent) || isParent) && children) {
          contents.push(
            h('ul.child-categories', children.filter(c => {
                return excluded.indexOf(c.slug) === -1;
              }).map(child => {
                return this.attach('layouts-category-link', {
                  category: child,
                  active: isCurrent(child)
                });
              })
            )
          )
        }
        
        return contents;
      })
    );
  }
});

createWidget('layouts-category-link', {
  tagName: 'li',
  buildKey: (attrs) => `layouts-category-link-${attrs.category.id}`,
  
  defaultState(attrs) {
    return {
      extraClasses: [],
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
    
    if (attrs.active) {
      contents.push(h('span.active-marker', { 
        attributes: { style: `background-color: #${category.color}` }
      }))
    }
    
    return contents;
  },
  
  click() {
    DiscourseURL.routeTo(this.attrs.category.url)
    return true;
  }
})
