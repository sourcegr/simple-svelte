import API from "./API";

const requests = {
    today: (dt, clientId) => API.GET(`/todaySales.php?date=${dt}&client_id=${clientId}`),
    loadOffers: () => API.GET(`/loadOffers.php`),
    save: product => API.POST(`/productSave.php`, product),
};

export {
    requests,
};
