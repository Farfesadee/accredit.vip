// Event types for CREATE INVITE and POST EVENT dropdowns

export const INVITE_EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'private_party', label: 'Private Party' },
  { value: 'corporate', label: 'Corporate Event' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'comedy', label: 'Comedy Show' },
  { value: 'magic_show', label: 'Magic Show' },
  { value: 'others', label: 'Others (specify)' },
];

export const EVENT_EVENT_TYPES = [
  { value: 'music_festival', label: 'Music Festival' },
  { value: 'sports', label: 'Sports Event' },
  { value: 'conference', label: 'Conference' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'comedy', label: 'Comedy Show' },
  { value: 'concert', label: 'Concert' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'networking', label: 'Networking Event' },
  { value: 'others', label: 'Others (specify)' },
];

export const DRESS_CODE_OPTIONS = [
  { value: 'black-tie', label: 'Black Tie' },
  { value: 'cocktail', label: 'Cocktail' },
  { value: 'formal', label: 'Formal' },
  { value: 'business', label: 'Business' },
  { value: 'casual', label: 'Casual' },
  { value: 'smart-casual', label: 'Smart Casual' },
];

export const DRESS_CODE_FEMALE_MALE = [
  { category: 'Female', options: ['Evening Gown', 'Cocktail Dress', 'Elegant Jumpsuit', 'Formal Dress', 'Blouse & Dress Pants'] },
  { category: 'Male', options: ['Tuxedo', 'Suit', 'Dress Shirt & Slacks', 'Blazer & Dress Pants', 'Formal Jacket'] },
];

export const getEventTypeLabel = (value: string, isInvite: boolean): string => {
  const types = isInvite ? INVITE_EVENT_TYPES : EVENT_EVENT_TYPES;
  return types.find((t) => t.value === value)?.label || value;
};
