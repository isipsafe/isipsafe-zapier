'use strict';

const { unwrap, url } = require('../lib/api');

const perform = async (z) => {
  const response = await z.request({ url: url('/categories'), method: 'GET' });
  const categories = unwrap(response);
  return (Array.isArray(categories) ? categories : [])
    .filter((category) => category && category.slug)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.group ? `${category.name} (${category.group})` : category.name,
      title: category.name,
      group: category.group || null,
      description: category.description || null,
    }));
};

module.exports = {
  key: 'categories',
  noun: 'Category',
  display: {
    label: 'List Report Categories',
    description: 'Lists isIPsafe report categories. Used to populate category dropdowns.',
    hidden: true,
  },
  operation: {
    perform,
    sample: {
      id: 22,
      slug: 'ssh',
      name: 'SSH (Authentication)',
      title: 'SSH',
      group: 'Authentication',
      description: 'Abuse of the SSH service. Use together with Brute-Force or Hacking.',
    },
    outputFields: [
      { key: 'id', label: 'Category ID', type: 'integer' },
      { key: 'slug', label: 'Slug' },
      { key: 'name', label: 'Name with Group' },
      { key: 'title', label: 'Name' },
      { key: 'group', label: 'Group' },
      { key: 'description', label: 'Description' },
    ],
  },
};
