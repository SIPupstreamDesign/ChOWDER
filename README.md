# ChOWDER

Cooperative workspace driver

## User Guide
### English
[./UserGuide/en/UserGuide.md](./UserGuide/en/UserGuide.md)
### Japanese
[./UserGuide/jp/UserGuide.md](./UserGuide/jp/UserGuide.md)

## Publications
KAWANABE, T., et al. On the Performance of Distributed Rendering System for 3DWebGIS Application on Ultra-High-Resolution Display. International Journal of Geoinformatics, 2025, 21.1: 15-25.

KAWANABE, Tomohiro; HATTA, Kazuma; ONO, Kenji. ChOWDER: A New Approach for Viewing 3D Web GIS on Ultra-High-Resolution Scalable Display. In: 2020 IEEE International Conference on Cluster Computing (CLUSTER). IEEE, 2020. p. 412-413.

KAWANABE, Tomohiro, et al. Showing Ultra-High-Resolution Images in VDA-Based Scalable Displays. In: International Conference on Cooperative Design, Visualization and Engineering. Cham: Springer International Publishing, 2019. p. 116-122.

KAWANABE, Tomohiro, et al. ChOWDER: an adaptive tiled display wall driver for dynamic remote collaboration. In: International Conference on Cooperative Design, Visualization and Engineering. Cham: Springer International Publishing, 2018. p. 11-15.



## Introduction of 3DWebGIS Distributed Rendering Feature

We added the 3DWebGIS distributed rendering feature.
This feature was developed based on [iTowns](https://github.com/itowns), and by distributing and rendering data across multiple browsers, it is possible to display data in ultra-high resolution and handle data that exceeds the browser's heap memory limit.

### Examples of the 3DWebGIS distributed rendering feature
#### An example of 3D WebGIS displayed on a tiled display consisting of 15 4K displays
![Use case 1](https://github.com/SIPupstreamDesign/ChOWDER/blob/master/fig_usecase01.jpg)
Data source: Geospatial Information Authority of Japan (https://maps.gsi.go.jp/development/ichiran.html) 

#### An example of cloud data captured by a weather satellite converted into a 3D point cloud and displayed
![Use case 2](https://github.com/SIPupstreamDesign/ChOWDER/blob/master/IMG_2998.jpg)
Data source (Cloud data): Himawari 8/9 gridded data are distributed by the Center for Environmental Remote Sensing (CEReS), Chiba University, Japan. Data source (Map): Geospatial Information Authority of Japan (https://maps.gsi.go.jp/development/ichiran.html) 

#### In the current version, unnatural triangular artifacts may appear when rendering the point clouds. We are currently investigating ways to improve this phenomenon.
![Artifacts](https://github.com/SIPupstreamDesign/ChOWDER/blob/master/IMG_2995.jpg)
