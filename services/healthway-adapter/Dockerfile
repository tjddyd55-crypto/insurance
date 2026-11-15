# Run stage.sh locally with licensed official materials before building this service context.
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY lib/ lib/
COPY src/ src/
COPY build.sh ./
RUN JAVA_HOME=/opt/java/openjdk ./build.sh
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/healthway-adapter.jar build/healthway-adapter.jar
COPY --from=build /app/lib/ lib/
COPY sample-data/ sample-data/
RUN mkdir runtime && chown -R 10001:10001 /app
USER 10001
ENV PORT=8080 HEALTHWAY_PROVIDER=offline
CMD ["java", "-jar", "build/healthway-adapter.jar"]
