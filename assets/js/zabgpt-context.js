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

    function getProblemRows() {
        const table = document.querySelector('table.list-table');
        if (!table) {
            return [];
        }

        return Array.from(table.querySelectorAll('tbody tr'));
    }

    function isTimeLikeText(value) {
        const text = String(value || '').trim();
        return /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(text);
    }

    function extractTriggerFromRow(row) {
        const triggerLink = row.querySelector('a[href*="triggerid"], a[href*="eventid"]');
        const strongTag = row.querySelector('td strong');
        const fallbackCell = row.querySelector('td:nth-child(4), td:nth-child(5)');

        let trigger = textOrEmpty(triggerLink) || textOrEmpty(strongTag) || textOrEmpty(fallbackCell) || 'N/A';
        if (isTimeLikeText(trigger)) {
            trigger = 'N/A';
        }

        return trigger;
    }

    function buildAlertGroups(rows, focusTrigger) {
        const groupedMap = {};

        rows.forEach((row) => {
            const trigger = extractTriggerFromRow(row) || 'N/A';
            const key = trigger.toLowerCase();
            const host = textOrEmpty(row.querySelector('a[href*="hostid"]')) || 'N/A';
            const severity = detectSeverityFromRow(row) || 'N/A';

            if (!groupedMap[key]) {
                groupedMap[key] = {
                    trigger: trigger,
                    count: 0,
                    hosts: {},
                    severities: {}
                };
            }

            groupedMap[key].count += 1;
            groupedMap[key].hosts[host] = true;
            groupedMap[key].severities[severity] = (groupedMap[key].severities[severity] || 0) + 1;
        });

        const groups = Object.keys(groupedMap)
            .map((key) => {
                const entry = groupedMap[key];
                return {
                    trigger: entry.trigger,
                    count: entry.count,
                    host_count: Object.keys(entry.hosts).length,
                    hosts: Object.keys(entry.hosts).slice(0, 8),
                    severities: entry.severities
                };
            })
            .sort((a, b) => b.count - a.count);

        const repeated = groups.filter((item) => item.count > 1).slice(0, 6);
        const focus = groups.find((item) => item.trigger.toLowerCase() === String(focusTrigger || '').toLowerCase()) || null;

        return {
            total_open_alert_rows: rows.length,
            grouped_alert_count: groups.length,
            repeated_alert_groups: repeated,
            top_alert_groups: groups.slice(0, 6),
            focus_trigger_group: focus,
            alert_group_summary: focus
                ? (focus.count + ' similar alerts across ' + focus.host_count + ' host(s) for trigger "' + focus.trigger + '".')
                : 'No repeated alert group detected for selected trigger.'
        };
    }

    function fromProblemsPage() {
        const row = getFirstProblemRow();
        if (!row) {
            return null;
        }

        const rows = getProblemRows();
        const hostLink = row.querySelector('a[href*="hostid"]');
        const logNode = row.querySelector('.opdata, [class*="opdata"]');
        const trigger = extractTriggerFromRow(row);
        const groupData = buildAlertGroups(rows, trigger);

        const context = {
            host: textOrEmpty(hostLink) || 'N/A',
            trigger: trigger || 'N/A',
            severity: detectSeverityFromRow(row) || 'N/A',
            last_metrics: extractMetricsFromProblemRow(row),
            logs: textOrEmpty(logNode),
            alert_group_summary: groupData.alert_group_summary,
            focus_trigger_group: groupData.focus_trigger_group,
            top_alert_groups: groupData.top_alert_groups,
            repeated_alert_groups: groupData.repeated_alert_groups,
            grouped_alert_count: groupData.grouped_alert_count,
            total_open_alert_rows: groupData.total_open_alert_rows,
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
