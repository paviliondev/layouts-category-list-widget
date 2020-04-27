import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';
import DiscourseURL from 'discourse/lib/url';

export default createWidget('layouts-category-list', {
  tagName: 'div.layouts-category-list.widget-container',

  html(attrs, state) {
    const { category, parentCategories, childCategories } = attrs;
    const excluded = settings.excluded_categories.split('|');
        
    return h('ul.parent-categories', parentCategories.filter(c => {
        return excluded.indexOf(c.slug) === -1;
      }).map(parent => {
        let contents = [];
              
        contents.push(
          this.attach('layouts-category-link', {
            category: parent
          })
        );
              
        if (category &&
            (category.slug == parent.slug ||
            (category.parentCategory && category.parentCategory.slug == parent.slug)) &&
            childCategories[parent.slug]) {
          
          contents.push(
            h('ul.child-categories',
              childCategories[parent.slug].filter(c => {
                return excluded.indexOf(c.slug) === -1;
              }).map(child => {
                return this.attach('layouts-category-link', {
                  category: child,
                  classes: child.up
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
        ),
        h('div.category-name', category.name)
      )
      if (state.extraClasses.indexOf('has-logo') === -1) {
        state.extraClasses.push('has-logo');
        this.scheduleRerender();
      }
    } else {
      contents.push(
        this.attach('category-link', {
          category,
          hideParent: true,
          allowUncategorized: false,
          link: false
        })
      )
    }
    
    return contents;
  },
  
  click() {
    DiscourseURL.routeTo(this.attrs.category.url)
    return true;
  }
})
