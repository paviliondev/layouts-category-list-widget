import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { htmlSafe } from "@ember/template";

export default class CategoryList extends Component {
  @service site;
  @service siteSettings;

  @tracked expandedCategory = null;
  @tracked sidebarMinimized = false;

  get allCategories() {
    return this.site.categories;
  }

  get excludedSlugs() {
    const excluded = (this.siteSettings.excluded_categories || "").split("|");
    return excluded.filter((slug) => slug.trim() !== "");
  }

  get mainCategories() {
    let categories = this.allCategories || [];
    return categories
      .filter(
        (cat) =>
          !cat.parent_category_id && !this.excludedSlugs.includes(cat.slug)
      )
      .map((cat) => ({
        ...cat,
        logoContent: this.getLogoContent(cat),
        isExpanded: false, // Add this new property
        hasChildren: categories.some(
          (subCat) => subCat.parent_category_id === cat.id
        ),
        subcategories: categories
          .filter((subCat) => subCat.parent_category_id === cat.id)
          .map((subCat) => ({
            ...subCat,
            logoContent: this.getLogoContent(subCat),
          })),
      }));
  }

  get customLinks() {
    return this.parseCustomLinks(this.siteSettings.custom_links || "");
  }

  getLogoContent(category) {
    if (category.logoUrl) {
      return { type: "image", url: category.logoUrl };
    } else {
      let color = Ember.Handlebars.Utils.escapeExpression(category.color);
      let text = Ember.Handlebars.Utils.escapeExpression(
        category.name.substring(0, 2)
      );
      let style = `border: 1px solid #${color};`;

      return {
        type: "text",
        text: text,
        style: htmlSafe(style),
      };
    }
  }

  get generateLogos() {
    return !settings.disable_category_logos;
  }

  parseCustomLinks(linksString) {
    return linksString.split("|").map((link) => {
      const [title, icon, url, options] = link.split(",");
      const opts = this.parseOptions(options);
      return { title, icon, url, options: opts };
    });
  }

  parseOptions(optionsString = "") {
    return optionsString.split(";").reduce((opts, opt) => {
      const [key, value] = opt.split(":");
      opts[key] = value;
      return opts;
    }, {});
  }

  @action
  toggleSubcategories(categoryId) {
    this.expandedCategory =
      this.expandedCategory === categoryId ? null : categoryId;
  }

  @action
  toggleSidebar() {
    this.sidebarMinimized = !this.sidebarMinimized;
  }
}
