window.ZabGPTContext = (function() {
    'use strict';

    function textOrEmpty(node) {
        return node && node.textContent ? node.textContent.trim() : '';
    }

    function detectSeverityFromRow(row) {
        if (!row) {
            return '';
        }

        const severityNode = row.querySelector('[class*="severity"], .status-indicator, [data-severity]');
        const value = textOrEmpty(severityNode) || (severityNode ? severityNode.getAttribute('title') || '' : '');
        if (value) {
            return value;
        }

        const text = textOrEmpty(row);
        const known = ['Disaster', 'High', 'Average', 'Warning', 'Information'];
        for (let i = 0; i < known.length; i++) {
            if (text.toLowerCase().indexOf(known[i].toLowerCase()) !== -1) {
                return known[i];
            }
        }

        return '';
    }

    function extractMetricsFromProblemRow(row) {
        if (!row) {
            return {};
        }

        const rowText = textOrEmpty(row);
        const metrics = {};

        const cpu = rowText.match(/cpu[^\d]*(\d{1,3}(?:\.\d+)?)\s*%/i);
        const memory = rowText.match(/memory[^\d]*(\d{1,3}(?:\.\d+)?)\s*%/i);
        const disk = rowText.match(/disk[^\d]*(\d{1,3}(?:\.\d+)?)\s*%/i);
        const load = rowText.match(/load[^\d]*(\d+(?:\.\d+)?)/i);

        if (cpu) {
            metrics.cpu = cpu[1] + '%';
        }
        if (memory) {
            metrics.memory = memory[1] + '%';
        }
        if (disk) {
            metrics.disk = disk[1] + '%';
        }
        if (load) {
            metrics.load_average = load[1];
        }

        return metrics;
    }

    function getFirstProblemRow() {
        const table = document.querySelector('table.list-table');
        if (!table) {
            return null;
        }

        const selected = table.querySelector('tbody tr.selected');
        if (selected) {
            return selected;
        }

        const first = table.querySelector('tbody tr');
        return first || null;
    }

    function fromProblemsPage() {
        const row = getFirstProblemRow();
        if (!row) {
            return null;
        }

        const hostLink = row.querySelector('a[href*="hostid"]');
        const triggerLink = row.querySelector('a[href*="triggerid"]');
        const logNode = row.querySelector('.opdata, [class*="opdata"]');
        
        // Fallback for trigger: look for strong tag or td with trigger-like content
        let trigger = textOrEmpty(triggerLink);
        if (!trigger) {
            const strongTag = row.querySelector('td strong');
            trigger = textOrEmpty(strongTag) || 'N/A';
        }
        // Ensure we don't capture time patterns as trigger
        if (trigger && /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/.test(trigger.trim())) {
            trigger = 'N/A';
        }

        const context = {
            host: textOrEmpty(hostLink) || 'N/A',
            trigger: trigger || 'N/A',
            severity: detectSeverityFromRow(row) || 'N/A',
            last_metrics: extractMetricsFromProblemRow(row),
            logs: textOrEmpty(logNode),
            source_page: 'problem.view',
            captured_at: new Date().toISOString()
        };

        return context;
    }

    function fromLatestDataPage() {
        const table = document.querySelector('form[name="items"] table.list-table, table.list-table');
        if (!table) {
            return null;
        }

        const row = table.querySelector('tbody tr');
        if (!row) {
            return null;
        }

        const hostLink = row.querySelector('a[href*="hostid"]');
        const nameLink = row.querySelector('a[href*="itemid"], td a');
        const valueCell = row.querySelector('td:last-child');

        return {
            host: textOrEmpty(hostLink) || 'N/A',
            trigger: textOrEmpty(nameLink) || 'Latest data anomaly',
            severity: 'Information',
            last_metrics: {
                sample: textOrEmpty(valueCell)
            },
            logs: '',
            source_page: 'latest.view',
            captured_at: new Date().toISOString()
        };
    }

    function collectContext() {
        const href = window.location.href;

        if (href.indexOf('action=problem.view') !== -1) {
            return fromProblemsPage() || {};
        }

        if (href.indexOf('action=latest.view') !== -1 || href.indexOf('latest.php') !== -1) {
            return fromLatestDataPage() || {};
        }

        return {
            host: 'N/A',
            trigger: 'N/A',
            severity: 'N/A',
            last_metrics: {},
            logs: '',
            source_page: 'generic',
            captured_at: new Date().toISOString()
        };
    }

    function severityClass(severity) {
        const value = String(severity || '').toLowerCase();
        if (value.indexOf('disaster') !== -1 || value.indexOf('critical') !== -1 || value.indexOf('high') !== -1) {
            return 'is-critical';
        }
        if (value.indexOf('warning') !== -1 || value.indexOf('average') !== -1 || value.indexOf('medium') !== -1) {
            return 'is-warning';
        }
        return 'is-info';
    }

    return {
        collectContext,
        severityClass
    };
})();
