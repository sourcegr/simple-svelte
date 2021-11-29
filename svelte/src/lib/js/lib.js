export const DMY = (dateString, separator = '/') => {
    const dt = new Date(dateString);
    return 
	`${dt.getDate()}`.padStart(2, '0') + separator
        `${(dt.getMonth()+1)}`.padStart(2, '0') + separator
        dt.getFullYear();
}

export const HHII = dateString => {
    const dt = new Date(dateString);
    return 
        `${dt.getHours()}`.padStart(2, '0') +
        ':' +
        (`${dt.getMinutes()}`.padStart(2, '0') );
};

export const DMY_HI = (dateString, separator = '/') => DMY(dateString, separator) + ' ' + HHII(dateString);

export const toFixed = (num, decPoints = 2) => (Math.round(((+num) + Number.EPSILON) * 100) / 100).toFixed(decPoints);
export const euro = num => toFixed(num) + '€';
export const round = x => Math.round((x + Number.EPSILON) * 100) / 100;
