var MainMap = (function() {

function hsla(h, s, l, a) {
  return 'hsla(' + h + ',' + 100 * s + '%,' + 100 * l + '%,' + a + ')';
}

function resultValuesToObj(result) {
  var o = {};
  for (var prop in result) {
    o[prop] = result[prop].value;
  }
  return o;
}

function MainMap(mainVizContainer) {
  this.DOM = {};
  this.mainVizContainer = mainVizContainer;
  this.init();
}

MainMap.prototype.initSVG = function() {
  this.w = window.innerWidth;
  this.h = window.innerHeight - 360;
  this.h = Math.min(this.h, 500);
  this.h = Math.max(300, this.h);
  this.svg = d3.select(this.mainVizContainer)
    .append('svg')
    .attr('width', this.w)
    .attr('height', this.h);

  this.svg.append('rect')
    .attr('fill', '#FAFAFA')
    .attr('class', 'bg')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', this.w)
    .attr('height', this.h);
}

MainMap.prototype.init = function() {
  this.initSVG();

  this.getOrganisations().then(function(organisations) {

    this.organisations = organisations;
    this.buildViz(organisations);
    this.hijackSearch();

    this.getCollaborations(); //pre cache
  }.bind(this));
}

MainMap.prototype.hijackSearch = function() {
  $('#q').parent().submit(function(e) {
    var searchTerm = $('#q').val();
    $('#q').val('');

    var foundOrgs = this.organisations.filter(function(org) {
      return org.label.toLowerCase().indexOf(searchTerm) != -1;
    });

    console.log('foundOrgs', foundOrgs)

    if (foundOrgs.length > 0) {
      this.showNetwork(foundOrgs[0].org);
    }

    $('#q').hide();
    e.preventDefault();
    return false;
  }.bind(this));
}

MainMap.prototype.getOrganisations = function() {
  var deferred = Q.defer();
  this.runOrganisationsQuery().then(function(results) {
    var organisations = results.map(resultValuesToObj);
    deferred.resolve(organisations);
  });
  return deferred.promise;
}

MainMap.prototype.getCollaborations = function() {
  if (!this.collaorationsPromise) {
    var deferred = Q.defer();
    var collaborations = {
      byProject: {},
      byOrganisation: {}
    };
    this.runCollaboratorsQuery().then(function(results) {
      results.forEach(function(c) {
        var org = c.org.value;
        var projects = c.activity_values.value.split(',');
        projects.forEach(function(project) {
          if (!collaborations.byProject[project]) collaborations.byProject[project] = [];
          collaborations.byProject[project].push(org);
          if (!collaborations.byOrganisation[org]) collaborations.byOrganisation[org] = [];
          collaborations.byOrganisation[org].push(project);
        });
        deferred.resolve(collaborations);
      })
    });
    this.collaorationsPromise = deferred.promise;
  }

  return this.collaorationsPromise;
}

MainMap.prototype.runOrganisationsQuery = function() {
  var SPARQL_URL = 'http://data.digitalsocial.eu/sparql.json?utf8=✓&query=';
  var ds = new SPARQLDataSource(SPARQL_URL);

  return ds.query()
    .prefix('o:', '<http://www.w3.org/ns/org#>')
    .prefix('rdfs:', '<http://www.w3.org/2000/01/rdf-schema#>')
    .prefix('geo:', '<http://www.w3.org/2003/01/geo/wgs84_pos#>')
    .prefix('vcard:', '<http://www.w3.org/2006/vcard/ns#>')
    .prefix('ds:', '<http://data.digitalsocial.eu/def/ontology/>')
    .select('?org ?label ?lon ?lat ?country ?city ?org_type ?tf ?activity ?activity_label')
    .where('?org', 'a', 'o:Organization')
    //.where('?org', 'ds:organizationType', '?org_type')
    .where('?org', 'rdfs:label', '?label')
    .where('?org', 'o:hasPrimarySite', '?org_site')
    .where('?org_site', 'geo:long', '?lon')
    .where('?org_site', 'geo:lat', '?lat')
    //.where('?org_site', 'o:siteAddress', '?org_address')
    //.where('?org_address', 'vcard:country-name', '?country')
    //.where('?org_address', 'vcard:locality', '?city')
    //.where("?am", "a", "ds:ActivityMembership")
    //.where("?am", "ds:organization", "?org")
    //.where("?am", "ds:activity", "?activity")
    //.where("?activity", "rdfs:label", "?activity_label")
    //.where("?activity", "ds:technologyMethod", "?tm")
    //  .where("?activity", "ds:technologyFocus", "?tf")
    .execute();
}

MainMap.prototype.runCollaboratorsQuery = function() {
  var SPARQL_URL = 'http://data.digitalsocial.eu/sparql.json?utf8=✓&query=';
  var ds = new SPARQLDataSource(SPARQL_URL);

  return ds.query()
    .prefix('o:', '<http://www.w3.org/ns/org#>')
    .prefix('rdfs:', '<http://www.w3.org/2000/01/rdf-schema#>')
    .prefix('geo:', '<http://www.w3.org/2003/01/geo/wgs84_pos#>')
    .prefix('vcard:', '<http://www.w3.org/2006/vcard/ns#>')
    .prefix('ds:', '<http://data.digitalsocial.eu/def/ontology/>')
    .select('?org (group_concat(distinct ?activity ; separator = ",") AS ?activity_values)')
    .where('?org', 'a', 'o:Organization')
    .where("?am", "a", "ds:ActivityMembership")
    .where("?am", "ds:organization", "?org")
    .where("?am", "ds:activity", "?activity")
    .groupBy("?org")
    .execute();
}

MainMap.prototype.buildViz = function(organisations) {
  var w = this.w;
  var h = this.h;
  var svg = this.svg;
  

  var scale  = 700;
  var offset = [w/2, h/2];
  var center = [10, 50];
  var projection = d3.geo.mercator()
    .scale(scale).center(center)
    .translate(offset);

  organisations.forEach(function(org) {
    var pos = projection([org.lon, org.lat]);
    org.x = pos[0];
    org.y = pos[1];
  });

  var organisationsById = {};
  organisations.forEach(function(org) {
    organisationsById[org.org] = org;
  });
  this.organisationsById = organisationsById;

  this.DOM.g = svg.append('g');
  this.DOM.mapGroup = this.DOM.g.append('g');
  this.DOM.networkGroup = this.DOM.g.append('g');
  this.DOM.orgGroup = this.DOM.g.append('g');

  var zoom = this.addZoom(svg, this.DOM.g, w, h);
  this.showWorldMap(svg, this.DOM.g, projection);
  this.showOrganisations(svg, this.DOM.g, projection, center, organisations, zoom);
  //this.showIsoLines(svg, this.DOM.g, organisations, w, h, zoom);
}

MainMap.prototype.addZoom = function(svg, g, w, h) {
  var rectSize = 30;
  var margin = 10;
  var spacing = 2;
  var zoomIn = svg.append('g');
  zoomIn.append('rect')
    .attr('fill', '#DDD')
    .attr('x', w - rectSize - margin)
    .attr('y', margin)
    .attr('width', rectSize)
    .attr('height', rectSize);
  zoomIn.append('text')
    .attr('fill', '#666')
    .text('+')
    .attr('x', w - rectSize*0.5 - margin)
    .attr('y', margin + rectSize*0.65)
    .attr('text-anchor', 'middle')

  var zoomOut = svg.append('g');
  zoomOut.append('rect')
    .attr('fill', '#DDD')
    .attr('x', w - rectSize - margin)
    .attr('y', margin + rectSize + spacing)
    .attr('width', rectSize)
    .attr('height', rectSize);
  zoomOut.append('text')
    .attr('fill', '#666')
    .text('-')
    .attr('x', w - rectSize*0.5 - margin)
    .attr('y', margin + rectSize + spacing + rectSize*0.65)
    .attr('text-anchor', 'middle')

  var prevScale = 1;

  //can't make animations work at the moment
  function updateTransform(translate, scale, animate) {
    if (animate) {
      prevScale = scale;
      //g.transition().duration(200).attr('transform','translate('+translate.join(',')+')scale('+scale+')');
      g.attr('transform','translate('+translate.join(',')+')scale('+scale+')');
    }
    else {
      g.attr('transform','translate('+translate.join(',')+')scale('+scale+')');
    }

    //if (scale < 0.5) {
    //  zoom.scale(0.5);
    //  zoom.event(svg);
    //}
  }

  var zoom = d3.behavior.zoom().on('zoom', function() {
    updateTransform(d3.event.translate, d3.event.scale);
  });

  zoomIn.on('click', function(e) {
    d3.event.stopPropagation()
    d3.event.preventDefault();
    var scale = 2;
    var newZoom = zoom.scale() * scale;
    if (newZoom > 2048) return;
    var newX = ((zoom.translate()[0] - (w / 2)) * scale) + w / 2;
    var newY = ((zoom.translate()[1] - (h / 2)) * scale) + h / 2;
    zoom.scale(newZoom);
    zoom.translate([newX, newY]);
    zoom.event(svg)
    return false;
  })

  zoomOut.on('click', function(e) {
    d3.event.stopPropagation()
    d3.event.preventDefault();
    var scale = 1/2;
    var newZoom = zoom.scale() * scale;
    if (newZoom < 0.3) return;
    var newX = ((zoom.translate()[0] - (w / 2)) * scale) + w / 2;
    var newY = ((zoom.translate()[1] - (h / 2)) * scale) + h / 2;
    zoom.scale(newZoom);
    zoom.translate([newX, newY])
    zoom.event(svg);
    return false;
  })

  svg.call(zoom)
  svg.on("dblclick.zoom", null);

  return zoom;
}

MainMap.prototype.showWorldMap = function(svg, g, projection) {
  d3.json("assets/world-110m.json", function(error, world) {
    var countries = topojson.feature(world, world.objects.countries).features;
    var neighbors = topojson.neighbors(world.objects.countries.geometries);

    var path = d3.geo.path()
      .projection(projection);

    this.DOM.mapGroup.selectAll(".country")
      .data(countries)
      .enter().insert("path", ".graticule")
      .attr("class", "country")
      .attr("d", path)
      .attr("stroke", "none")
      .attr("fill", "#EEE");
  }.bind(this));
}

MainMap.prototype.showOrganisations = function(svg, g, projection, center, organisations, zoom) {
  var circles = this.DOM.orgGroup.selectAll('circle.org').data(organisations);

  circles.enter()
    .append('circle')
    .attr('class', 'org')
    .attr('r', 2)
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('transform', function(d) {
      var pos = projection(center);
      return "translate(" + pos[0] + "," + pos[1] + ")"
    })

  circles
    .transition()
    .duration(300)
    .attr('transform', function(d) {
      return "translate(" + d.x + "," + d.y + ")"
    })
    .attr('fill', 'rgba(0,0,0,0.1)')
    .attr('stroke', 'rgba(0,0,0,0.3)')
    .attr('r', 3)

  circles.exit().transition().duration(300).attr('r', 0).remove();

  circles.on('click', function(organization) {
    this.showNetwork(organization.org)
  }.bind(this));

  zoom.on('zoom.circles', function() {
    var r = 3 * 1/d3.event.scale * Math.pow(d3.event.scale, 0.29);
    var strokeWidth = 1 / d3.event.scale;
    circles
      .attr('r', r)
      .attr('stroke-width', strokeWidth)
    g.selectAll('line.network').attr('stroke-width', 1/d3.event.scale);
  });

  var NESTA = "http://data.digitalsocial.eu/id/organization/eb70a18d-2f2b-62fd-76ca-5a33f71b9f50";

  //TODO: verify this is correct data

  //showNetwork(NESTA);
}

MainMap.prototype.showNetwork = function(org, limit) {
  this.getCollaborations().then(function(collaborations) {
    var projects = collaborations.byOrganisation[org];
    var collaborators = [];

    if (!projects) return;
    projects.forEach(function(project) {
      collaborations.byProject[project].forEach(function(member) {
        if (member == org) return;
        if (collaborators.indexOf('member') == -1) {
          collaborators.push(member);
        }
      })
    });

    var ns = 'org'
    if (limit) {
      collaborators = collaborators.filter(function(c) {
        return limit.indexOf(c) != -1;
      });
      ns += limit.indexOf(org);
    }
    else {
      this.DOM.networkGroup.selectAll('line.network').remove(); //remove existing
    }

    var networkPaths = this.DOM.networkGroup.selectAll('line.network.' + ns).data(collaborators);
    networkPaths.enter()
      .append('line')
      .attr('class', 'network ' + ns)
      .attr('x1', function() { return this.organisationsById[org].x; }.bind(this))
      .attr('y1', function() { return this.organisationsById[org].y; }.bind(this))
      .attr('x2', function(c) { return this.organisationsById[c].x; }.bind(this))
      .attr('y2', function(c) { return this.organisationsById[c].y; }.bind(this))
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('opacity', limit ? 0.05 : 1)

    if (!limit) {
      collaborators.forEach(function(org_collab) {
        this.showNetwork(org_collab, collaborators)
      }.bind(this));
    }
  }.bind(this));
}

MainMap.prototype.showIsoLines = function(svg, g, organisations, w, h, zoom) {
  var randomPoints;
  var numPoints = 4002;

  var color = hsla(0, 0, 0, 0.2);

  if (localStorage['randomPoints'] && localStorage['randomPoints'] != 'null') {
    randomPoints = JSON.parse(localStorage['randomPoints']);
    if (randomPoints.length != numPoints) {
      randomPoints = null;
    }
  }
  if (!randomPoints) {
    var d = 30;
    randomPoints = d3.range(0, numPoints).map(function(i) {
      return [ Math.random() * w, Math.random() * h, 1];
      //return [ 200 + (i % d)/d * (w - 200), Math.floor(i / d)/d * h, 1];
    });
    localStorage['randomPoints'] = JSON.stringify(randomPoints);
  }

  var minR = 30;
  var minR2 = minR * minR;

  randomPoints.forEach(function(p) {
    organisations.forEach(function(org) {
      var dx = p[0] - org.x;
      var dy = p[1] - org.y;
      if (dx*dx + dy*dy < minR2) {
        p[2]++;
      }
    })
  })

  /*
  //Debug circles
  var points = g.selectAll('circle.triPoint').data(randomPoints);
  points.enter()
    .append('circle')
    .attr('class', 'triPoint')
    //.style('fill', 'rgba(255,0,0,0.2)');
    .style('fill', 'none')
    .style('stroke', 'rgba(255,0,0,0.2)');

  points.exit().remove()

  points
    .attr('cx', function(d) { return d[0]; })
    .attr('cy', function(d) { return d[1]; })
    //.attr('r', function(d) { return Math.pow(d[2], 0.47); })
    .attr('r', minR)
    //.style('display', 'none');
  */

  var triangles = d3.geom.delaunay(randomPoints);
  var toArrayOfPoints = function(p) { return [p[0], p[1]]; };

  var linePoints = [];

  function sections(p1, p2, mod, p3) {
    var val1 = p1[2];
    var val2 = p2[2];
    var val3 = p3[2];
    if (val1 < val2) {
      var start = Math.ceil(val1 / mod) * mod;
      var dist = val2 - val1;
      var results = [];
      for(var v = start; v <= val2; v += mod) {
        var ratio = (val1 == val2) ? 0 : (v-val1)/(val2-val1);
        results.push({ value: v, ratio: ratio, point: [p1[0]+(p2[0]-p1[0])*ratio, p1[1]+(p2[1]-p1[1])*ratio] });
      }
      return results;
    }
    else {
      var start = Math.ceil(val2 / mod) * mod;
      var dist = val1 - val2;
      var results = [];
      for(var v = start; v <= val1; v += mod) {
        var ratio = (val1 == val2) ? 0 : 1.0-(v-val2)/(val1-val2);
        if (ratio == 0 && (val1 == val2 && val2 == val3)) continue;
        results.push({ value: v, ratio: ratio, point: [p1[0]+(p2[0]-p1[0])*ratio, p1[1]+(p2[1]-p1[1])*ratio] });
      }
      return results;
    }
  }

  function addLines(sections1, sections2) {
    for(var i=0; i<sections1.length; i++) {
      for(var j=0; j<sections2.length; j++) {
        if (sections1[i].value == sections2[j].value) {
          linePoints.push([sections1[i].point, sections2[j].point, sections2[j].value])
        }
      }
    }
  }

  triangles.forEach(function(triangle, triangeIndex) {
    var p0 = triangle[0];
    var p1 = triangle[1];
    var p2 = triangle[2];
    var sections0 = sections(p0, p1, 10, p2);
    var sections1 = sections(p0, p2, 10, p1);
    var sections2 = sections(p1, p2, 10, p0);
    addLines(sections0, sections1);
    addLines(sections0, sections2);
    addLines(sections1, sections2);
  })

  g.selectAll("g.isoLine").remove();
  var path = g.append("g").attr("class", 'isoLine').selectAll("path.isoLine");
  path = path.data(linePoints.map(function(d) {
    return {
      data: "M" + toArrayOfPoints(d).join("L") + "",
      value: d[2]
    };
  }));
  path.exit().remove();
  path.enter()
    .append("path")
    .attr('stroke', color)
    .attr("d", function(d) { return d.data });
  path.style('fill', 'none');

  zoom.on('zoom.isolines', function() {
    path.attr('stroke-width', function() {
      return 2 /  d3.event.scale;
    })
  });
}


return MainMap;

})();