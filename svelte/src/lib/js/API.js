const apiUrl = "/php";

function ApiError(message, data) {
    const error = new Error(message);
    error.data = data;
    return error;
}

ApiError.prototype = Object.create(Error.prototype);


const getHeaders = () => {
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };
};
const getPOSTHeaders = getHeaders;

const handleError = e => {
    return [e, null];
};

const setJson = async response => {
    const details = await response.json();

    if (response && response.status) {
        if (response.status == 200) {
            return [null, details];
        }
        if (response.status == 401) {
            alert('You are signed out. Please login.');
            document.location.reload();
            return ['reload', null];
        }
    }

    const msg = (details && details.message) || response.statusText;
    const data = (details && details.payload) || null;
    throw new ApiError(msg, data, response.status);
};


const POST = async (url, obj, image = null) => {
    if (image) {
        formData.append('image', image);
    }

    return await fetch(`${apiUrl}${url}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(obj)
    }).then(setJson).catch(handleError);
};

const PATCH = async (url, obj) => {
    let formData = new FormData();
    formData.append("payload", JSON.stringify(obj));

    return await fetch(`${apiUrl}${url}`, {
        method: 'PATCH',
        headers: getHeaders(),
        // body: new URLSearchParams(o)
        body: JSON.stringify(obj)
    }).then(setJson).catch(handleError);
};

const GET = async (url, o = null) => {
    const extra = o ? `?` + new URLSearchParams(o) : '';

    return await fetch(`${apiUrl}${url}${extra}`, {
        headers: getHeaders()
    }).then(setJson).catch(handleError);
};

const DELETE = async (url, o = null) => {
    const extra = o ? `?` + new URLSearchParams(o) : '';

    return await fetch(`${apiUrl}${url}${extra}`, {
        method: 'DELETE',
        headers: getHeaders()
    }).then(setJson).catch(handleError);
};


export default {
    POST, GET, PATCH, DELETE
}
