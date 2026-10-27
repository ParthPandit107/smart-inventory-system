/**
 * CSV Generator Utility
 * Converts arrays of objects into properly escaped CSV strings
 */

function generateCsv(data, columns) {
    if (!data || !data.length) {
        return columns.map(c => `"${c.label}"`).join(',') + '\n';
    }

    const header = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
    
    const rows = data.map(row => {
        return columns.map(col => {
            let val = row[col.key];
            if (val === null || val === undefined) {
                val = '';
            } else if (typeof val === 'number') {
                val = val.toString();
            } else {
                val = String(val).replace(/"/g, '""');
            }
            return `"${val}"`;
        }).join(',');
    });

    return [header, ...rows].join('\r\n');
}

module.exports = {
    generateCsv
};
