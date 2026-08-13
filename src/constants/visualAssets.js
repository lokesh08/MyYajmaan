// Stable local SVG illustrations for devotional and ritual-themed screens.
// These files are bundled under public/images and render reliably without external dependencies.
export const pujaImages = {
  ganesh: '/images/puja-ganesh.svg',
  satyanarayan: '/images/puja-satyanarayan.svg',
  grihaPravesh: '/images/puja-griha-pravesh.svg',
  navgraha: '/images/puja-navgraha.svg',
};

export const festivalImages = {
  diwali: '/images/festival-diwali.svg',
  ganeshChaturthi: '/images/festival-ganesh.svg',
  akshayaTritiaya: '/images/festival-akshaya.svg',
  mahaShivratri: '/images/festival-shivratri.svg',
};

export const panditPortraits = [
  '/images/pandit-1.jpg',
  '/images/pandit-2.jpg',
  '/images/pandit-3.jpg',
  '/images/pandit-4.jpg',
];

export const authBackgrounds = {
  login: '/images/auth-login.svg',
  register: '/images/auth-register.svg',
};

export const bookingFallbackImage = '/images/booking-fallback.svg';

export const pujas = [
  {
    id: 1,
    title: "Ganesh Puja",
    price: "₹1,499",
    duration: "1 - 2 hours",
    image: pujaImages.ganesh,
  },
  {
    id: 2,
    title: "Satyanarayan Puja",
    price: "₹1,799",
    duration: "1 - 2 hours",
    image: pujaImages.satyanarayan,
  },
  {
    id: 3,
    title: "Griha Pravesh Puja",
    price: "₹2,499",
    duration: "1.5 - 2 hours",
    image: pujaImages.grihaPravesh,
  },
  {
    id: 4,
    title: "Navgraha Shanti",
    price: "₹3,200",
    duration: "3 - 5 hours",
    image: pujaImages.navgraha,
  },
];

export const pandits = [
  {
    id: 1,
    name: "Pandit Rajesh Sharma",
    price: "₹1,200",
    rating: 4.9,
    reviews: 124,
    image: panditPortraits[0],
  },
  {
    id: 2,
    name: "Pandit Vivek Mishra",
    price: "₹1,800",
    rating: 4.8,
    reviews: 98,
    image: panditPortraits[1],
  },
  {
    id: 3,
    name: "Pandit Dinesh Pathak",
    price: "₹2,500",
    rating: 4.7,
    reviews: 76,
    image: panditPortraits[2],
  },
  {
    id: 4,
    name: "Pandit Gaurav Joshi",
    price: "₹1,600",
    rating: 4.6,
    reviews: 58,
    image: panditPortraits[3],
  },
];

export const festivals = [
  { name: "Raja Bhonsle", date: "18 Aug 2024", image: festivalImages.diwali },
  {
    name: "Ganesh Chaturthi",
    date: "7 Sep 2024",
    image: festivalImages.ganeshChaturthi,
  },
  {
    name: "Akshaya Tritiya",
    date: "12 Jun 2024",
    image: festivalImages.akshayaTritiaya,
  },
  {
    name: "Maha Shivratri",
    date: "15 Mar 2024",
    image: festivalImages.mahaShivratri,
  },
];