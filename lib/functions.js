const getAdmins = (participants) => {
	if (typeof participants != 'object') return false;
	let array = new Array();
	for(let v of participants) {
		if (/admin|superadmin/gi.test(v.admin)) array.push(v.id);
	}
	return array.map(v => v);
};

export { getAdmins };