(function() {
  var showIntro = (document.location.hash !== '#nointro');

  function init() {
    var url = window.location.href;
    var urlIsLocalhost = (url.match(/localhost/) !== null);
    var urlIsVariableIO = (url.match(/variable\.io/) !== null);
    var urlIsOrganisation = (url.match(/\/organisations\//) !== null);
    var urlIsBeta = (url.match(/\/beta/) !== null);

    if (urlIsOrganisation) {
      // get organisation id
      var orgId = url.split("/").pop().replace(/\.html$/, "");

      // draw organisation stats
      initOrgStats(orgId);
    }
    else if (urlIsLocalhost || urlIsVariableIO || urlIsBeta) {
      if (document.location.pathname != '/' && document.location.pathname.indexOf('beta') == -1) {
        return;
      }
      var mainContainer = document.getElementById('main');
      mainContainer.removeChild(mainContainer.childNodes[0]);
      mainContainer.removeChild(mainContainer.childNodes[0]);

      var vizContainer = $('#viz');

      initEvents();

      initVisualizations(vizContainer);
      if (showIntro) {
        initIntroViz(vizContainer);
      }
    }
  }

  function initEvents() {
    VizConfig.events = EventDispatcher.extend({});
  }

  function initVisualizations(vizContainer) {
    initMainViz(vizContainer);
    initCaseStudies(vizContainer);
    initEUCountries(vizContainer);
    initChoropleth(vizContainer);
    initExplorer(vizContainer);
    initMainStats(vizContainer, { timeout: 4000 });
    initVizKey();
    initPopup();
    initTooltip();
  }

  function initIntroViz(vizContainer, cb) {
    var introViz = $('<div id="introViz"></div>');
    vizContainer.append(introViz);
    function onExplore() {
      VizConfig.vizKey.open();
      introViz.fadeOut('slow');
    }
    var intro = new Intro(introViz, onExplore);
  }

  function initTooltip() {
    VizConfig.tooltip = new VizTooltip();
  }

  function initPopup() {
    VizConfig.popup = new VizPopup();
  }

  function initMainViz(vizContainer) {
    var mainViz = $('<div id="mainViz"></div>');
    vizContainer.append(mainViz);

    new MainMap("#mainViz");
  }

  function initCaseStudies(vizContainer) {
    var caseStudiesTitle = $('<h1 id="caseStudiesTitle">Case Studies</h1>');
    vizContainer.append(caseStudiesTitle);

    var caseStudiesViz = $('<div id="caseStudiesViz"></div>');
    vizContainer.append(caseStudiesViz);

    var carouselDiv = $('<div id="carousel"></div>');
    var carouselFilters = $('<div class="filters"></div>');
    var carouselPrev = $('<div class="button button-prev">&lang;</div>');
    var carouselNext = $('<div class="button button-next">&rang;</div>');
    var carouselWrap = $('<div class="carousel-wrapper"></div>');
    carouselDiv.append(carouselPrev);
    carouselDiv.append(carouselNext);
    carouselDiv.append(carouselFilters);
    carouselDiv.append(carouselWrap);
    caseStudiesViz.append(carouselDiv);

    var carousel = new Carousel({
      "filters": $("#carousel > .filters"),
      "wrapper": $("#carousel >.carousel-wrapper"),
      "buttonPrev": $("#carousel > .button-prev"),
      "buttonNext": $("#carousel > .button-next")
    });
  }

  function initEUCountries(vizContainer) {
    var euCountriesTitle = $('<h1 id="countriesVizTitle">EU Countries with the most DSI Projects <a href="#">(Show all)</a></h1>');
    vizContainer.append(euCountriesTitle);

    euCountriesTitle.select('a').click(function(e) {
      $('div.map').show();
      e.preventDefault();
      return false;
    })

    var countriesViz = $('<div id="countriesViz"></div>');
    vizContainer.append(countriesViz);

    var countries = new Countries("#countriesViz");
    countries.init();
  }

  function initChoropleth(vizContainer) {
    var choroplethTitle = $('<h1>Number of projects by technology focus and DSI area</h1>');
    vizContainer.append(choroplethTitle);

    var choroplethViz = $('<div id="choroplethViz"></div>');
    vizContainer.append(choroplethViz);

    var choroplethColors = ["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"];

    var choropleth = new Choropleth("#choroplethViz");
    choropleth.init();
  }

  function initExplorer(vizContainer) {
    var explorerTitle = $('<h1>Technology focus areas and methods</h1>');
    vizContainer.append(explorerTitle);

    var explorerViz = $('<div id="explorerViz"></div>');
    vizContainer.append(explorerViz);

    var explorer = new Explorer("#explorerViz");
    explorer.init();
  }

  function initMainStats(vizContainer, settings) {
    settings.timeout = settings.timeout || 0;

    var mainStatsTitle = $('<h1>Stats</h1>');
    vizContainer.append(mainStatsTitle);

    var mainStatsViz = $('<div id="mainStatsViz"></div>');
    vizContainer.append(mainStatsViz);

    setTimeout(function() {
      var mainStats = new MainStats("#mainStatsViz", { minValue: 10 });
      mainStats.init();
    }, settings.timeout);
  }

  function initVizKey() {
    var openOnInit = !showIntro;
    VizConfig.vizKey = new VizKey(openOnInit);
  }

  function initOrgStats(orgId) {
    var divs = {
      "dsi": ".viz-1",
      "tech": ".viz-2",
      "collaborators": ".viz-3"
    };

    var openVizKey = false;
    var showMoreFilters = false;
    var vizKey = new VizKey(openVizKey, showMoreFilters);

    var stats = new Stats(divs, orgId);
    stats.init();

    initPopup();
    initTooltip();
  }

  window.addEventListener('DOMContentLoaded', init);
})();

