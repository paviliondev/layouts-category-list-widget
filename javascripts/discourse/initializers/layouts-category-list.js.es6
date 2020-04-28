import { addSidebarProps } from 'discourse/plugins/discourse-layouts/discourse/lib/layouts';

export default {
  name: 'layouts-category-list',
  initialize(container) {
    const site = container.lookup('site:main');
    const categories = site.categories.filter(c => !c.isUncategorizedCategory);
    const parentCategories = [];
    const childCategories = {};

    categories.forEach(function(c) {
      let parent = c.parentCategory;
      if (parent) {
        let siblings = childCategories[parent.slug] || []
        siblings.push(c);
        childCategories[parent.slug] = siblings;
      } else {
        parentCategories.push(c);
      }
    });
    
    const props = {
      parentCategories,
      childCategories
    }
    
    addSidebarProps(props);
  }
}