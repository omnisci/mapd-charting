dc.mapdTable = function (parent, chartGroup) {

    var _chart = dc.baseMixin({});
    var _tableWrapper = null;

    var _size = 25;
    var _offset = 0;
    var _debounce = false;

    var _filteredColumns = {};
    var _columnFilterMap = {};
    var _tableFilter = null;
    var _sortColumn = null;
    var _dimOrGroup = null;

    _chart.resetTable = function(){
        _chart.select('.md-table-wrapper').remove();
    }

    _chart.tableFilter = function (_) {
        if (!arguments.length) {
            return _tableFilter;
        }
        _tableFilter = _;
        return _chart;
    };

    _chart.sortColumn = function (_) {
        if (!arguments.length) {
            return _sortColumn;
        }
        _sortColumn = _;
        return _chart;
    };

    _chart.tableWrapper = function (_) {
        if (!arguments.length) {
            return _tableWrapper;
        }
        _tableWrapper = _;
        return _chart;
    };

    var addRowsCallback = function(data){
        _chart.dataCache = _chart.dataCache.concat(data)
        _chart._doRedraw();
        _debounce = false;
    }

    _chart.addRows = function(){

        _dimOrGroup = _chart.dimension().value().length > 0 ? _chart.group() : _chart.dimension();

        _offset += _size;

        if (_sortColumn && _sortColumn.order === 'desc') {
            _dimOrGroup.topAsync(_size, _offset, undefined, [addRowsCallback]);
        } else {
            _dimOrGroup.bottomAsync(_size, _offset, undefined, [addRowsCallback]);
        }
        _debounce = true;

    }

    _chart.data(function() {
        if (!_chart.dataCache) {
            _dimOrGroup = _chart.dimension().value().length > 0 ? _chart.group() : _chart.dimension();
            _chart.dataCache = _sortColumn ?
                (_sortColumn.order === 'desc' ?
                    _dimOrGroup.order(_sortColumn.col.name).top(_size + _offset, 0) :
                    _dimOrGroup.order(_sortColumn.col.name).bottom(_size + _offset, 0)) :
                _dimOrGroup.order(null).top(_size + _offset, 0);
         }
        return _chart.dataCache;
    });

    _chart.setDataAsync(function(group,callbacks) {

        _offset = 0;

        _dimOrGroup = _chart.dimension().value().length > 0 ? _chart.group() : _chart.dimension();

        if (_sortColumn && _sortColumn.order === 'desc') {
            _dimOrGroup.order(_sortColumn.col.name).topAsync(_size, _offset, undefined, callbacks);
        } else {
             _dimOrGroup.order(_sortColumn ? _sortColumn.col.name : (_chart.dimension().value().length > 0 ? 'key0' : null)).bottomAsync(_size, _offset, undefined, callbacks);
        }

        if (_tableWrapper) {
            _tableWrapper.select('.md-table-scroll').node().scrollTop = 0;
        }

    });

    _chart.addFilteredColumn = function(columnName) {
      _filteredColumns[columnName] = null;
    };

    _chart.removeFilteredColumn = function(columnName) {
      delete _filteredColumns[columnName];
    };

    _chart.clearFilteredColumns = function() {
      _filteredColumns = {};
    };

    _chart.getFilteredColumns = function() {
      return _filteredColumns;
    };

    _chart.clearTableFilter = function () {
        _columnFilterMap = {};
        _chart.clearFilteredColumns();
        _tableFilter.filter();
    }

    _chart._doRender = function () {

        if (!_tableWrapper) {
            _chart.resetTable();
            _tableWrapper = _chart.root().append('div')
                .attr('class', 'md-table-wrapper');

            _tableWrapper.append('div')
                .attr('class', 'md-header-spacer');

            _tableWrapper.append('div')
                .attr('class', 'md-table-scroll')
                .append('table');

            _tableWrapper.append('div')
                .attr('class', 'md-table-header')
        }

        _debounce = false;

        renderTable();

        return _chart;
    };


    function renderTable() {

        var data = _chart.data();

        var table = _chart.tableWrapper().select('table').html('');

        if (data.length === 0) {
            return;
        }

        var cols = [];

        if (_chart.dimension().value().length > 0) {
            _chart.dimension().value().forEach(function(d, i){
                cols.push({expression: d, name: 'key'+i });
            });
            _chart.group().reduce().forEach(function(d){
                if (d.expression) {
                    cols.push({expression: d.expression, name: d.name, agg_mode: d.agg_mode });
                }
            });

        } else {
            cols = _chart.dimension().getProjectOn().map(function(d){
                var splitStr = d.split(' as ');
                return {expression: splitStr[0], name: splitStr[1]};
            });
        }


        var tableHeader = table.append('tr').selectAll('th')
            .data(cols)
            .enter();

        tableHeader.append('th')
            .text(function(d){ return (d.agg_mode ? d.agg_mode.toUpperCase() : '') + ' ' + d.expression });

        var tableRows = table.selectAll('.table-row')
            .data(data)
            .enter();

        var rowItem = tableRows.append('tr');

        cols.forEach(function(col, i){

            rowItem.append('td')
                .text(function(d){
                    return d[col.name];
                })
                .classed('filtered', col.expression in _filteredColumns)
                .classed('disabled', !!col.agg_mode || _chart.dimension().value().length === 1)
                .on('click', function(d){
                    if (col.expression in _filteredColumns) {
                        clearColFilter(col.expression);
                    } else {
                        filterCol(col.expression, d[col.name]);
                    }
                });
        });

        var dockedHeader = _chart.tableWrapper().select('.md-table-header').html('')
            .append('div')
            .attr('class', 'docked-table-header')
            .style('left', function(){
               return '-' + _tableWrapper.select('.md-table-scroll').node().scrollLeft + 'px';
            });


        _chart.tableWrapper().select('.md-table-scroll')
            .on('scroll', function(){

                dockedHeader.style('left',  '-' + d3.select(this).node().scrollLeft + 'px');

                var scrollHeight = d3.select(this).node().scrollTop + d3.select(this).node().getBoundingClientRect().height;

                if (!_debounce && table.node().scrollHeight <=  scrollHeight + scrollHeight/5) {
                    _chart.addRows();
                }

            });

        table.selectAll('th')
            .each(function(d, i){
                var headerItem = dockedHeader.append('div')
                    .attr('class','table-header-item')
                    .classed('isFiltered', function(){
                        return d.expression in _filteredColumns;
                    });

                var sortLabel = headerItem.append('div')
                    .attr('class', 'table-sort')
                    .classed('active', _sortColumn ? _sortColumn.index === i : false)
                    .classed(_sortColumn ? _sortColumn.order : '',  true)
                    .on('click', function(){
                        _tableWrapper.selectAll('.table-sort')
                            .classed('active asc desc', false);

                        if (_sortColumn && _sortColumn.index === i) {

                            _sortColumn =  _sortColumn.order === 'desc' ? {index: i, col: d,  order: 'asc'} : null;

                        } else {
                            _sortColumn =  {index: i, col: d, order: 'desc'};
                        }

                        var sortEvent = new Event('sort', {
                          bubbles: true,
                          cancelable: true
                        });

                        sortEvent.sortColumn = _sortColumn;

                        var headerDOMNode = headerItem[0][0];
                        headerDOMNode.dispatchEvent(sortEvent);

                        dc.redrawAll();

                    })
                    .style('width', d3.select(this).node().getBoundingClientRect().width + 'px');


                var textSpan = sortLabel.append('span')
                    .text((d.agg_mode ? d.agg_mode.toUpperCase() : '') + ' ' + d.expression);

                var sortButton = sortLabel.append('div')
                    .attr('class', 'sort-btn');


                sortButton.append('svg')
                    .attr('class', 'svg-icon')
                    .classed('icon-sort', true)
                    .attr('viewBox', '0 0 48 48')
                    .append('use')
                    .attr('xlink:href', '#icon-sort');

                sortButton.append('svg')
                    .attr('class', 'svg-icon')
                    .classed('icon-sort-arrow', true)
                    .attr('viewBox', '0 0 48 48')
                    .append('use')
                    .attr('xlink:href', '#icon-arrow1');

                var unfilterButton = headerItem.append('div')
                    .attr('class', 'unfilter-btn')
                    .attr('data-expr', d.expression)
                    .on('click', function(){
                        clearColFilter(d3.select(this).attr('data-expr'));
                    })
                    .style('left', textSpan.node().getBoundingClientRect().width + 20 + 'px')
                    .append('svg')
                    .attr('class', 'svg-icon')
                    .classed('icon-unfilter', true)
                    .attr('viewBox', '0 0 48 48')
                    .append('use')
                    .attr('xlink:href', '#icon-unfilter');
            });

    }

    function filterCol(expr, val) {

      var dateFormat = d3.time.format.utc("%Y-%m-%d");
      var timeFormat = d3.time.format.utc("%Y-%m-%d %H:%M:%S");

      if (Object.prototype.toString.call(val) === '[object Date]') {
        val = "DATE '" + dateFormat(val) + "'";
      }
      else if (val && typeof val === 'string') {
          val = "'" + val.replace(/'/g, "''") + "'";
      }

      _chart.addFilteredColumn(expr);
      _columnFilterMap[expr] = val;
      _tableFilter.filter(computeTableFilter(_columnFilterMap));

      dc.redrawAll();
    }


    function clearColFilter(expr) {
      delete _columnFilterMap[expr];
      _chart.removeFilteredColumn(expr);
      _tableFilter.filter(computeTableFilter(_columnFilterMap));
      dc.redrawAll();
    }

    function computeTableFilter (columnFilterMap) { // should use class variables?
        var filter = "";
        var subFilterExpression = null;

        for (var expr in columnFilterMap) {
          if (columnFilterMap[expr] === "null") { // null gets translated to "null" by this point
            subFilterExpression = expr + " IS null";
          }
          else {
            subFilterExpression = expr + " = " + columnFilterMap[expr];
          }

          if (filter == "") {
            filter += subFilterExpression;
          }
          else {
            filter += " AND " + subFilterExpression;
          }
        }
        return filter;
    }

    _chart._doRedraw = function () {
        return _chart._doRender();
    };

    _chart.size = function (size) {
        if (!arguments.length) {
            return _size;
        }
        _size = size;
        return _chart;
    };

    _chart.order = function (order) {
        if (!arguments.length) {
            return _order;
        }
        _order = order;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};
