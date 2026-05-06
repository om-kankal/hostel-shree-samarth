export const getAdminToken = () => sessionStorage.getItem('adminToken') || '';
export const getStudentToken = () => sessionStorage.getItem('studentToken') || '';

export const authHeaders = (token, extra = {}) => ({
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const adminHeaders = (extra = {}) => authHeaders(getAdminToken(), extra);
export const studentHeaders = (extra = {}) => authHeaders(getStudentToken(), extra);

export const clearAdminSession = () => {
    sessionStorage.removeItem('adminAuth');
    sessionStorage.removeItem('adminToken');
};

export const clearStudentSession = () => {
    sessionStorage.removeItem('studentAuth');
    sessionStorage.removeItem('studentToken');
    sessionStorage.removeItem('studentRegistration');
    sessionStorage.removeItem('studentName');
};
