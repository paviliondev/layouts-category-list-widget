export default {
  name: 'layouts-category-list',
  initialize(container) {
    const siteSettings = container.lookup('site-settings:main');
    const site = container.lookup('site:main');
    const currentUser = container.lookup('current-user:main');

    if (
      !siteSettings.layouts_enabled ||
      (site.mobileView && !siteSettings.layouts_mobile_enabled) ||
      (siteSettings.login_required && !currentUser)
    )
      return;

    let layoutsError;
    let layouts;

    try {
      layouts = requirejs(
        'discourse/plugins/discourse-layouts/discourse/lib/layouts'
      );
    } catch (error) {
      layoutsError = error;
      console.warn(layoutsError);
    }

    if (layoutsError) return;

    const categories = site.categories.filter(
      (c) => !c.isUncategorizedCategory
    );
    const parentCategories = [];
    const childCategories = {};
    const categoryIds = [];

    categories.forEach(function (c) {
      let parent = c.parentCategory;
      if (parent) {
        if (!settings.hide_subcategories) {
          let siblings = childCategories[parent.slug] || [];
          siblings.push(c);
          childCategories[parent.slug] = siblings;
        }
      } else {
        parentCategories.push(c);
      }
      categoryIds.push(c.id);
    });

    const props = {
      parentCategories,
      childCategories,
      categoryIds,
    };

    layouts.addSidebarProps(props);
  },
};
